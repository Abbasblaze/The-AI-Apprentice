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
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        marginTop: '8px',
        borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
        overflow: 'hidden',
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
            borderTop: '1px solid var(--color-border)',
          }}
        >
          {quote && <span>&ldquo;{quote}&rdquo;</span>}
          {quoteT !== null && (
            <span style={{ fontStyle: 'normal', fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-signal)' }}>
              [{fmtT(quoteT)}]
            </span>
          )}
        </div>
      )}
      {!reducedMotion && !playing && (
        <button
          onClick={startAutoplay}
          className="btn-ghost"
          style={{ margin: '8px 12px', fontSize: '11px', padding: '3px 10px' }}
        >
          Replay
        </button>
      )}
    </div>
  )
}

/** A brief green chip that auto-dismisses after 2 s */
function AllowedChip({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '20px',
        background: 'var(--color-ok-dim)',
        border: '1px solid rgba(34,197,94,0.3)',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--color-ok)',
        animation: 'fade-in-up 0.2s ease-out both',
        alignSelf: 'flex-start',
      }}
    >
      <span style={{ fontSize: '14px' }}>&#10003;</span>
      Action allowed
    </div>
  )
}

type PageState = 'idle' | 'starting' | 'active' | 'ended'

interface TranscriptMessage {
  role: 'user' | 'agent'
  message: string
}

/** Circular progress ring SVG */
function ProgressRing({
  value,
  total,
  color,
  size = 56,
  strokeWidth = 5,
}: {
  value: number
  total: number
  color: string
  size?: number
  strokeWidth?: number
}) {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const pct = total > 0 ? value / total : 0
  const dash = circumference * pct
  const cx = size / 2

  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.4s ease' }}
      />
    </svg>
  )
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
  const [lastVerdict, setLastVerdict] = useState<{ verdict: 'allow' | 'block'; rule?: string; question?: string } | null>(null)
  const [showAllowedChip, setShowAllowedChip] = useState(false)
  const predictionStats = { correct: 0, wrong: 0 }
  const channelRef = useRef<BroadcastChannel | null>(null)
  const erpWindowRef = useRef<Window | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

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
        if (verdict.verdict === 'block') {
          setLastVerdict({
            verdict: 'block',
            rule: verdict.explanation,
            question: verdict.asks_why,
          })
          setShowAllowedChip(false)
        } else {
          setLastVerdict(null)
          setShowAllowedChip(true)
        }
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

  // ── IDLE: map selector ───────────────────────────────────────────────────
  if (pageState === 'idle') {
    return (
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: '100dvh', backgroundColor: 'var(--color-paper)' }}
      >
        <header
          style={{ borderBottom: '1px solid var(--color-border)' }}
          className="flex items-center justify-between px-5 py-3 shrink-0"
        >
          <h1
            className="text-base font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}
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

        <main className="flex-1 overflow-auto px-6 py-8">
          <div style={{ maxWidth: '680px', margin: '0 auto' }}>
            <div style={{ marginBottom: '28px' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--color-ink)',
                  marginBottom: '6px',
                }}
              >
                Choose a process to practise
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-graphite)', margin: 0 }}>
                The tutor will watch your ERP actions and guide you in real time.
              </p>
            </div>

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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {maps.map((map) => (
                  <div
                    key={map.session_id}
                    className="glass-card"
                    style={{
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      backdropFilter: 'blur(8px)',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(61,126,255,0.4)'
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 1px rgba(61,126,255,0.12), var(--shadow-md)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: 'var(--color-ink)',
                          marginBottom: '8px',
                          fontFamily: 'var(--font-heading)',
                          lineHeight: 1.3,
                        }}
                      >
                        {map.process_name}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        <span
                          className="chip chip-neutral"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}
                        >
                          {map.steps.length} steps
                        </span>
                        {map.expert_confirmed && (
                          <span className="chip chip-ok">
                            <span style={{ marginRight: '3px' }}>&#10003;</span> Confirmed
                          </span>
                        )}
                        {map.demo_ready && !map.expert_confirmed && (
                          <span className="chip chip-signal">Demo</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => void handleStartTutoring(map)}
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      Start tutoring
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ── STARTING ─────────────────────────────────────────────────────────────
  if (pageState === 'starting') {
    return (
      <div
        style={{
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-paper)',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-signal)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: '14px', color: 'var(--color-graphite)', margin: 0 }}>
          Opening ERP…
        </p>
      </div>
    )
  }

  // ── ENDED ─────────────────────────────────────────────────────────────────
  if (pageState === 'ended' && summary) {
    const masteredCount = summary.mastered_steps.length
    const totalSumSteps = summary.mastered_steps.length + summary.practice_next.length

    return (
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: '100dvh', backgroundColor: 'var(--color-paper)' }}
      >
        <header
          style={{ borderBottom: '1px solid var(--color-border)' }}
          className="flex items-center justify-between px-5 py-3 shrink-0"
        >
          <h1
            className="text-base font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}
          >
            <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
              The AI Apprentice
            </Link>
          </h1>
          <Link href="/tutor" className="btn-ghost" style={{ fontSize: '12px', padding: '4px 12px' }}>
            New session
          </Link>
        </header>

        <main className="flex-1 overflow-auto px-6 py-7">
          <div style={{ maxWidth: '680px', margin: '0 auto' }}>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--color-ink)',
                marginBottom: '20px',
              }}
            >
              Session summary
            </h2>

            {/* Metric cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '28px',
              }}
            >
              {[
                {
                  label: 'Interventions',
                  value: summary.total_interventions,
                  color: 'var(--color-flag)',
                  ring: { value: summary.total_interventions, total: Math.max(summary.total_interventions, 10) },
                },
                {
                  label: 'Steps mastered',
                  value: `${masteredCount} / ${totalSumSteps}`,
                  color: 'var(--color-ok)',
                  ring: { value: masteredCount, total: totalSumSteps },
                },
                {
                  label: 'Correct predictions',
                  value: summary.correct_predictions,
                  color: 'var(--color-signal)',
                  ring: { value: summary.correct_predictions, total: Math.max(summary.total_predictions, 1) },
                },
              ].map(({ label, value, color, ring }) => (
                <div
                  key={label}
                  className="glass-card"
                  style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                >
                  <ProgressRing value={ring.value} total={ring.total} color={color} />
                  <span className="stat-number" style={{ color, fontSize: '20px' }}>
                    {value}
                  </span>
                  <span className="label-upper">{label}</span>
                </div>
              ))}
            </div>

            {/* Summary text */}
            <div
              className="glass-card"
              style={{ padding: '16px 18px', marginBottom: '24px', fontSize: '13px', color: 'var(--color-ink)', lineHeight: '1.65' }}
            >
              {summary.summary_text}
            </div>

            {/* Mastered steps */}
            {summary.mastered_steps.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div className="label-upper" style={{ marginBottom: '10px' }}>Mastered</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {summary.mastered_steps.map((title) => (
                    <div
                      key={title}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 14px',
                        background: 'var(--color-ok-dim)',
                        border: '1px solid rgba(34,197,94,0.2)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px',
                        color: 'var(--color-ink)',
                      }}
                    >
                      <span style={{ color: 'var(--color-ok)', fontWeight: 700, fontSize: '15px' }}>&#10003;</span>
                      {title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Practice next */}
            {summary.practice_next.length > 0 && (
              <div>
                <div className="label-upper" style={{ marginBottom: '10px' }}>Practice next</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {summary.practice_next.map((title) => {
                    const stepObj = activeMap?.steps.find((s) => s.title === title)
                    return (
                      <div
                        key={title}
                        className="glass-card"
                        style={{ padding: '12px 14px' }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: stepObj?.reason.quote ? '6px' : '0' }}>
                          {title}
                        </div>
                        {stepObj?.reason.quote && (
                          <div style={{ fontSize: '12px', color: 'var(--color-graphite)', fontStyle: 'italic', lineHeight: 1.5 }}>
                            &ldquo;{stepObj.reason.quote}&rdquo;
                            {stepObj.reason.quote_t !== null && (
                              <span
                                style={{
                                  fontStyle: 'normal',
                                  marginLeft: '6px',
                                  fontVariantNumeric: 'tabular-nums',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '11px',
                                  color: 'var(--color-signal)',
                                }}
                              >
                                [{fmtT(stepObj.reason.quote_t)}]
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ── ACTIVE session ────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', backgroundColor: 'var(--color-paper)' }}
    >
      <header
        style={{ borderBottom: '1px solid var(--color-border)' }}
        className="flex items-center justify-between px-5 py-3 shrink-0"
      >
        <h1
          className="text-base font-semibold tracking-tight"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}
        >
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            The AI Apprentice
          </Link>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeMap && (
            <span style={{ fontSize: '12px', color: 'var(--color-graphite)' }}>
              {activeMap.process_name}
            </span>
          )}
          <button
            onClick={() => void handleEndSession()}
            className="btn-ghost"
            style={{ fontSize: '12px', padding: '4px 12px' }}
          >
            End session
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* LEFT PANEL — work map steps */}
        <div
          style={{
            flex: '0 0 58%',
            borderRight: '1px solid var(--color-border)',
            overflow: 'auto',
            padding: '0',
          }}
        >
          {activeMap && (
            <>
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'var(--color-panel)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span className="label-upper">{activeMap.process_name}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-graphite)', fontVariantNumeric: 'tabular-nums' }}>
                  {completedSteps} / {totalSteps} steps
                </span>
              </div>

              {activeMap.steps.map((step) => {
                const isCurrent = step.id === currentStepId
                const isVisited = visitedStepIds.has(step.id)

                return (
                  <div key={step.id}>
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: isCurrent
                          ? '3px solid var(--color-signal)'
                          : '3px solid transparent',
                        background: isCurrent ? 'rgba(61,126,255,0.05)' : 'transparent',
                        transition: 'background 0.2s',
                      }}
                    >
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: isVisited
                            ? 'var(--color-ok)'
                            : isCurrent
                              ? 'var(--color-signal)'
                              : 'var(--color-surface)',
                          border: isVisited || isCurrent ? 'none' : '1px solid var(--color-border)',
                          color: isVisited || isCurrent ? '#fff' : 'var(--color-graphite)',
                          fontSize: '10px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontFamily: 'var(--font-mono)',
                          transition: 'background 0.2s',
                        }}
                      >
                        {isVisited ? '✓' : step.order}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: isCurrent ? 'var(--color-ink)' : isVisited ? 'var(--color-ok)' : 'var(--color-ink)',
                            marginBottom: '3px',
                            lineHeight: 1.3,
                          }}
                        >
                          {step.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-graphite)', lineHeight: 1.4 }}>
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

        {/* RIGHT PANEL — stats + verdict + transcript */}
        <div
          style={{
            flex: '0 0 42%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Metric cards */}
          <div
            style={{
              padding: '12px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-panel)',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            }}
          >
            {[
              { label: 'Interventions', value: interventionCount, color: 'var(--color-flag)' },
              { label: 'Steps done', value: `${completedSteps}/${totalSteps}`, color: 'var(--color-ok)' },
              { label: 'Correct', value: predictionStats.correct, color: 'var(--color-signal)' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <span className="label-upper">{label}</span>
                <span
                  className="stat-number"
                  style={{ color, fontSize: '18px', fontFamily: 'var(--font-mono)' }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Current step indicator */}
          {currentStep && (
            <div
              style={{
                padding: '8px 14px',
                borderBottom: '1px solid var(--color-border)',
                background: 'rgba(61,126,255,0.06)',
                fontSize: '12px',
                color: 'var(--color-graphite)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--color-signal)',
                  flexShrink: 0,
                }}
                className="live-dot"
              />
              <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>
                {currentStep.title}
              </span>
            </div>
          )}

          {/* Verdict area */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', minHeight: '0' }}>
            {showAllowedChip && (
              <AllowedChip onDone={() => setShowAllowedChip(false)} />
            )}

            {lastVerdict?.verdict === 'block' && (
              <div
                style={{
                  width: '100%',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.35)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  animation: 'fade-in-up 0.2s ease-out both',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      lineHeight: 1,
                    }}
                    aria-hidden="true"
                  >
                    ⚠
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      color: 'var(--color-flag)',
                    }}
                  >
                    Action blocked
                  </span>
                </div>

                {lastVerdict.rule && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-ink)',
                      marginBottom: '8px',
                      lineHeight: 1.5,
                      padding: '6px 10px',
                      background: 'rgba(0,0,0,0.25)',
                      borderRadius: '4px',
                      borderLeft: '2px solid var(--color-flag)',
                    }}
                  >
                    {lastVerdict.rule}
                  </div>
                )}

                {lastVerdict.question && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-ink-muted)',
                      fontStyle: 'italic',
                      lineHeight: 1.5,
                    }}
                  >
                    {lastVerdict.question}
                  </div>
                )}

                <button
                  onClick={() => setLastVerdict(null)}
                  style={{
                    marginTop: '10px',
                    fontSize: '11px',
                    color: 'var(--color-graphite)',
                    background: 'none',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: '4px',
                    padding: '3px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {!showAllowedChip && !lastVerdict && (
              <span style={{ fontSize: '12px', color: 'var(--color-graphite)', fontStyle: 'italic' }}>
                No active verdict
              </span>
            )}
          </div>

          {/* Transcript */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div className="label-upper" style={{ marginBottom: '10px' }}>
              Transcript
            </div>

            {transcript.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--color-graphite)', fontStyle: 'italic' }}>
                Waiting for session to begin…
              </p>
            )}

            {transcript.map((entry, i) => {
              const isAgent = entry.role === 'agent'
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: isAgent ? 'row' : 'row-reverse',
                    gap: '8px',
                    alignItems: 'flex-end',
                    marginBottom: '6px',
                    animation: 'fade-in-up 0.18s ease-out both',
                  }}
                >
                  {/* Avatar dot */}
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: isAgent ? 'var(--color-signal-dim)' : 'rgba(136,152,179,0.15)',
                      border: `1px solid ${isAgent ? 'rgba(61,126,255,0.3)' : 'rgba(136,152,179,0.2)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: isAgent ? 'var(--color-signal)' : 'var(--color-graphite)',
                      flexShrink: 0,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {isAgent ? 'AI' : 'U'}
                  </div>

                  {/* Bubble */}
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '8px 12px',
                      borderRadius: isAgent
                        ? '4px 12px 12px 12px'
                        : '12px 4px 12px 12px',
                      background: isAgent
                        ? 'var(--color-surface)'
                        : 'var(--color-signal-dim)',
                      border: `1px solid ${isAgent ? 'var(--color-border)' : 'rgba(61,126,255,0.25)'}`,
                      fontSize: '12px',
                      color: 'var(--color-ink)',
                      lineHeight: '1.55',
                    }}
                  >
                    {entry.message}
                  </div>
                </div>
              )
            })}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
