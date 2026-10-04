'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useConversation } from '@elevenlabs/react'

import {
  createTutorSession,
  endTutorSession,
  fetchSignedUrl,
  getTutorSummary,
  listMapsForTutor,
  snapshotUrl,
} from '@/lib/apiClient'
import { ERP_CHANNEL } from '@/lib/erp/broadcast'
import type { ErpBroadcastMessage } from '@/lib/erp/types'
import type { MasterySummary, SnapshotIndexEntry, Step, TutorSession, WorkMap } from '@/lib/types'

function fmtT(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

interface FilmStripProps {
  sessionId: string
  snapshots: SnapshotIndexEntry[]
  centerT: number
  quote: string | null
  quoteT: number | null
}

function FilmStrip({ sessionId, snapshots, centerT, quote, quoteT }: FilmStripProps) {
  const WINDOW = 5
  const MIN_FRAMES = 3

  const nearby = snapshots.filter((s) => Math.abs(s.t - centerT) <= WINDOW)
  const frames =
    nearby.length >= MIN_FRAMES
      ? nearby
      : [...snapshots]
          .sort((a, b) => Math.abs(a.t - centerT) - Math.abs(b.t - centerT))
          .slice(0, MIN_FRAMES)
          .sort((a, b) => a.t - b.t)

  const [frameIdx, setFrameIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const reducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const startAutoplay = useCallback(() => {
    if (reducedMotion) return
    setFrameIdx(0)
    setPlaying(true)
  }, [reducedMotion])

  useEffect(() => {
    if (!playing) return
    timerRef.current = setInterval(() => {
      setFrameIdx((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [playing, frames.length])

  const currentFrame = frames[frameIdx]
  if (!currentFrame) return null

  return (
    <div
      style={{
        borderTop: '1px solid var(--color-rule)',
        borderBottom: '1px solid var(--color-rule)',
        background: 'var(--color-paper)',
        marginTop: '8px',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={snapshotUrl(sessionId, currentFrame.t)}
        alt={`Expert screen at ${fmtT(currentFrame.t)}`}
        style={{ width: '100%', display: 'block' }}
      />
      {(quote || quoteT !== null) && (
        <div
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            color: 'var(--color-graphite)',
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px',
          }}
        >
          {quote && <span>&ldquo;{quote}&rdquo;</span>}
          {quoteT !== null && (
            <span style={{ fontStyle: 'normal', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              [{fmtT(quoteT)}]
            </span>
          )}
        </div>
      )}
      {!reducedMotion && !playing && (
        <button
          onClick={startAutoplay}
          style={{
            display: 'block',
            margin: '0 12px 8px',
            fontSize: '12px',
            color: 'var(--color-graphite)',
            background: 'none',
            border: '1px solid var(--color-rule)',
            borderRadius: '4px',
            padding: '3px 10px',
            cursor: 'pointer',
          }}
        >
          Replay
        </button>
      )}
    </div>
  )
}

type PageState = 'idle' | 'starting' | 'active' | 'ended'

interface TranscriptMessage {
  role: 'user' | 'agent'
  message: string
}

export default function TutorPage() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [maps, setMaps] = useState<WorkMap[] | null>(null)
  const [mapsError, setMapsError] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<TutorSession | null>(null)
  const [activeMap, setActiveMap] = useState<WorkMap | null>(null)
  const [currentStepId, setCurrentStepId] = useState<string | null>(null)
  const [visitedStepIds, setVisitedStepIds] = useState<Set<string>>(new Set())
  const [filmStripStep, setFilmStripStep] = useState<Step | null>(null)
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([])
  const [summary, setSummary] = useState<MasterySummary | null>(null)
  const [interventionCount, setInterventionCount] = useState(0)
  const predictionStats = { correct: 0, wrong: 0 }
  const channelRef = useRef<BroadcastChannel | null>(null)
  const erpWindowRef = useRef<Window | null>(null)

  const { startSession, endSession, sendUserMessage } = useConversation({
    onConnect: () => {},
    onDisconnect: () => {},
    onMessage: ({ message, source: _source }) => {
      if (_source === 'ai') {
        setTranscript((prev) => [...prev, { role: 'agent', message }])
      }
    },
    onModeChange: () => {},
  })

  useEffect(() => {
    listMapsForTutor()
      .then(setMaps)
      .catch((err: unknown) =>
        setMapsError(err instanceof Error ? err.message : 'Failed to load maps'),
      )
  }, [])

  const matchStepToAction = useCallback(
    (actionType: string, map: WorkMap): Step | null => {
      const lower = actionType.toLowerCase()
      if (lower === 'change_cost_center') {
        return (
          map.steps.find(
            (s) =>
              s.decision.toLowerCase().includes('cost center') ||
              s.decision.toLowerCase().includes('code'),
          ) ?? null
        )
      }
      if (lower === 'hold') {
        return (
          map.steps.find(
            (s) =>
              s.decision.toLowerCase().includes('hold') ||
              s.decision.toLowerCase().includes('discrepancy'),
          ) ?? null
        )
      }
      if (lower === 'send_for_approval') {
        return (
          map.steps.find(
            (s) =>
              s.decision.toLowerCase().includes('approval') ||
              s.decision.toLowerCase().includes('send'),
          ) ?? null
        )
      }
      if (lower === 'post') {
        return map.steps.find((s) => s.decision.toLowerCase().includes('post')) ?? null
      }
      return null
    },
    [],
  )

  useEffect(() => {
    if (pageState !== 'active' || !activeMap) return

    const channel = new BroadcastChannel(ERP_CHANNEL)
    channelRef.current = channel

    channel.onmessage = (event: MessageEvent<ErpBroadcastMessage>) => {
      const msg = event.data
      if (msg.type === 'erp-events') {
        for (const evt of msg.events) {
          const matched = matchStepToAction(evt.kind + '_' + (evt.field ?? ''), activeMap)
          if (matched) {
            setCurrentStepId(matched.id)
            setVisitedStepIds((prev) => new Set([...prev, matched.id]))
          }
        }
      } else if (msg.type === 'tutor-block') {
        const verdict = msg.verdict
        setInterventionCount((n) => n + 1)
        if (verdict.step_id) {
          const step = activeMap.steps.find((s) => s.id === verdict.step_id) ?? null
          setFilmStripStep(step)
        }
        sendUserMessage(`[INTERVENE] ${verdict.asks_why}`)
      }
    }

    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [pageState, activeMap, matchStepToAction, sendUserMessage])

  async function handleStartTutoring(map: WorkMap) {
    setPageState('starting')
    try {
      const session = await createTutorSession(map.session_id)
      setActiveSession(session)
      setActiveMap(map)

      const erpWindow = window.open(
        `/erp?set=newhire&tutor=${session.id}`,
        'erp-tutor',
      )
      erpWindowRef.current = erpWindow

      const signedUrl = await fetchSignedUrl('tutor')
      startSession({ signedUrl })

      setPageState('active')
    } catch {
      setPageState('idle')
    }
  }

  async function handleEndSession() {
    if (!activeSession) return
    try {
      await endTutorSession(activeSession.id)
      const masterySummary = await getTutorSummary(activeSession.id)
      setSummary(masterySummary)
      sendUserMessage(`[SUMMARY] ${masterySummary.summary_text}`)
      endSession()
    } catch {
      endSession()
    }
    setPageState('ended')
  }

  const currentStep = activeMap?.steps.find((s) => s.id === currentStepId) ?? null
  const totalSteps = activeMap?.steps.length ?? 0
  const completedSteps = visitedStepIds.size

  if (pageState === 'idle') {
    return (
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: '100dvh', backgroundColor: 'var(--color-paper)' }}
      >
        <header
          style={{ borderBottom: '1px solid var(--color-rule)' }}
          className="flex items-center justify-between px-5 py-3 bg-panel shrink-0"
        >
          <h1
            className="text-base font-medium tracking-tight"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
              The AI Apprentice
            </Link>
          </h1>
          <Link
            href="/sessions"
            className="text-sm"
            style={{ color: 'var(--color-signal)', textDecoration: 'none' }}
          >
            Sessions
          </Link>
        </header>

        <main className="flex-1 overflow-auto px-6 py-5">
          <h2
            className="text-sm font-medium mb-4"
            style={{ color: 'var(--color-graphite)', fontFamily: 'var(--font-heading)' }}
          >
            Select a process to practice
          </h2>

          {mapsError && (
            <p className="text-sm" style={{ color: 'var(--color-flag)' }}>
              {mapsError}
            </p>
          )}

          {maps === null && !mapsError && (
            <p className="text-sm" style={{ color: 'var(--color-graphite)' }}>
              Loading…
            </p>
          )}

          {maps !== null && maps.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--color-graphite)' }}>
              No confirmed or demo-ready work maps found.
            </p>
          )}

          {maps !== null && maps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '560px' }}>
              {maps.map((map) => (
                <div
                  key={map.session_id}
                  style={{
                    padding: '14px 16px',
                    border: '1px solid var(--color-rule)',
                    background: 'var(--color-panel)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--color-ink)',
                        marginBottom: '2px',
                        fontFamily: 'var(--font-heading)',
                      }}
                    >
                      {map.process_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-graphite)' }}>
                      {map.steps.length} steps
                      {map.demo_ready && (
                        <span style={{ marginLeft: '8px', color: 'var(--color-flag)' }}>demo</span>
                      )}
                      {map.expert_confirmed && (
                        <span style={{ marginLeft: '8px', color: 'var(--color-signal)' }}>confirmed</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => void handleStartTutoring(map)}
                    style={{
                      padding: '5px 14px',
                      fontSize: '13px',
                      fontWeight: 500,
                      background: 'var(--color-signal)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Start tutoring
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    )
  }

  if (pageState === 'starting') {
    return (
      <div
        style={{
          height: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-paper)',
          color: 'var(--color-graphite)',
          fontSize: '14px',
        }}
      >
        Opening ERP…
      </div>
    )
  }

  if (pageState === 'ended' && summary) {
    return (
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: '100dvh', backgroundColor: 'var(--color-paper)' }}
      >
        <header
          style={{ borderBottom: '1px solid var(--color-rule)' }}
          className="flex items-center justify-between px-5 py-3 bg-panel shrink-0"
        >
          <h1
            className="text-base font-medium tracking-tight"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
              The AI Apprentice
            </Link>
          </h1>
          <Link
            href="/tutor"
            className="text-sm"
            style={{ color: 'var(--color-signal)', textDecoration: 'none' }}
          >
            New session
          </Link>
        </header>

        <main className="flex-1 overflow-auto px-6 py-5" style={{ maxWidth: '640px' }}>
          <h2
            className="text-base font-semibold mb-4"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}
          >
            Session summary
          </h2>

          <div
            style={{
              fontSize: '13px',
              color: 'var(--color-ink)',
              marginBottom: '20px',
              lineHeight: '1.6',
            }}
          >
            {summary.summary_text}
          </div>

          <div style={{ marginBottom: '24px', fontSize: '13px', color: 'var(--color-graphite)', fontVariantNumeric: 'tabular-nums' }}>
            {summary.mastered_steps.length} of {(summary.mastered_steps.length + summary.practice_next.length)} steps mastered
            {' · '}
            {summary.correct_predictions} predictions correct
            {' · '}
            {summary.total_interventions} interventions
          </div>

          {summary.mastered_steps.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-graphite)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '8px',
                }}
              >
                Mastered
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {summary.mastered_steps.map((title) => (
                  <li key={title} style={{ fontSize: '13px', color: 'var(--color-ink)', padding: '3px 0' }}>
                    {title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.practice_next.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-graphite)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '8px',
                }}
              >
                Practice next
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {summary.practice_next.map((title) => {
                  const stepObj = activeMap?.steps.find((s) => s.title === title)
                  return (
                    <li key={title}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-ink)', marginBottom: '2px' }}>
                        {title}
                      </div>
                      {stepObj?.reason.quote && (
                        <div style={{ fontSize: '12px', color: 'var(--color-graphite)', fontStyle: 'italic' }}>
                          &ldquo;{stepObj.reason.quote}&rdquo;
                          {stepObj.reason.quote_t !== null && (
                            <span style={{ fontStyle: 'normal', marginLeft: '4px', fontVariantNumeric: 'tabular-nums' }}>
                              [{fmtT(stepObj.reason.quote_t)}]
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </main>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', backgroundColor: 'var(--color-paper)' }}
    >
      <header
        style={{ borderBottom: '1px solid var(--color-rule)' }}
        className="flex items-center justify-between px-5 py-3 bg-panel shrink-0"
      >
        <h1
          className="text-base font-medium tracking-tight"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            The AI Apprentice
          </Link>
        </h1>
        <button
          onClick={() => void handleEndSession()}
          style={{
            fontSize: '12px',
            color: 'var(--color-graphite)',
            background: 'none',
            border: '1px solid var(--color-rule)',
            borderRadius: '4px',
            padding: '3px 10px',
            cursor: 'pointer',
          }}
        >
          End session
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div
          style={{
            flex: '0 0 60%',
            borderRight: '1px solid var(--color-rule)',
            overflow: 'auto',
            padding: '0',
          }}
        >
          {activeMap && (
            <>
              <div
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--color-rule)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-graphite)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {activeMap.process_name}
              </div>

              {activeMap.steps.map((step) => {
                const isCurrent = step.id === currentStepId
                const isVisited = visitedStepIds.has(step.id)

                return (
                  <div key={step.id}>
                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--color-rule)',
                        borderLeft: isCurrent
                          ? '3px solid var(--color-signal)'
                          : '3px solid transparent',
                        background: isCurrent ? 'var(--color-panel)' : 'transparent',
                      }}
                    >
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: isVisited ? 'var(--color-signal)' : 'var(--color-ink)',
                          color: 'var(--color-paper)',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {step.order}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--color-ink)',
                            marginBottom: '2px',
                          }}
                        >
                          {step.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-graphite)' }}>
                          {step.decision}
                        </div>
                      </div>
                    </div>

                    {isCurrent && filmStripStep?.id === step.id && activeSession && (
                      <FilmStrip
                        sessionId={activeSession.work_map_session_id}
                        snapshots={[]}
                        centerT={step.screen_moment.snapshot_t}
                        quote={step.reason.quote}
                        quoteT={step.reason.quote_t}
                      />
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>

        <div
          style={{
            flex: '0 0 40%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-rule)',
              background: 'var(--color-panel)',
              fontSize: '12px',
              color: 'var(--color-graphite)',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            <div>
              <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>Current step: </span>
              {currentStep?.title ?? '—'}
            </div>
            <div>
              <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>Steps completed: </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{completedSteps} / {totalSteps}</span>
            </div>
            <div>
              <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>Interventions: </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{interventionCount}</span>
            </div>
            <div>
              <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>Predictions: </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {predictionStats.correct} correct, {predictionStats.wrong} wrong
              </span>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-graphite)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '8px',
              }}
            >
              Transcript
            </div>
            {transcript.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--color-graphite)' }}>
                Waiting for session to begin…
              </p>
            )}
            {transcript.map((entry, i) => (
              <div
                key={i}
                style={{
                  marginBottom: '8px',
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: entry.role === 'agent' ? 'var(--color-signal)' : 'var(--color-graphite)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                    paddingTop: '1px',
                    minWidth: '40px',
                  }}
                >
                  {entry.role === 'agent' ? 'Tutor' : 'You'}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--color-ink)', lineHeight: '1.5' }}>
                  {entry.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
