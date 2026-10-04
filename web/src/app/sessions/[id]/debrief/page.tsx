'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useConversation } from '@elevenlabs/react'

import {
  answerDebrief,
  fetchSignedUrl,
  postTranscriptEntries,
  replyDebrief,
  startDebrief,
  snapshotUrl,
} from '@/lib/apiClient'
import type {
  DebriefPhase,
  Gap,
  Step,
  TranscriptEntry,
  WorkMap,
} from '@/lib/types'

const ANSWER_SILENCE_MS = 2000
const TRANSCRIPT_FLUSH_MIN = 3

function fmtT(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function fmtTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const isHigh = confidence >= 0.8
  return (
    <div
      style={{
        height: '3px',
        background: 'var(--color-border)',
        borderRadius: '2px',
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.round(confidence * 100)}%`,
          background: isHigh ? 'var(--color-signal)' : 'var(--color-flag)',
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  )
}

function StepCard({
  step,
  sessionId,
  isSelected,
  onSelect,
}: {
  step: Step
  sessionId: string
  isSelected: boolean
  onSelect: () => void
}) {
  const snapSrc = snapshotUrl(sessionId, step.screen_moment.snapshot_t)

  return (
    <div
      onClick={onSelect}
      style={{
        margin: '6px 8px',
        borderRadius: 'var(--radius-md)',
        background: isSelected ? 'var(--color-surface)' : 'var(--color-panel)',
        border: '1px solid var(--color-border)',
        boxShadow: isSelected ? '0 0 0 2px #3d7eff40' : 'none',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, background 0.15s',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: isSelected ? 'var(--color-signal)' : 'var(--color-border)',
              color: isSelected ? '#fff' : 'var(--color-graphite)',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {step.order}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)' }}>
                {step.title}
              </span>
              {step.is_judgment_call && (
                <span className="chip chip-flag" style={{ fontSize: '9px', padding: '1px 5px' }}>
                  judgment
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-graphite)', marginBottom: '6px', lineHeight: 1.4 }}>
              {step.decision}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ConfidenceBar confidence={step.confidence} />
              <span
                style={{
                  fontSize: '10px',
                  color: step.confidence >= 0.8 ? 'var(--color-signal)' : 'var(--color-flag)',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 600,
                }}
              >
                {Math.round(step.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {isSelected && (
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            padding: '10px 12px',
            background: 'rgba(61,126,255,0.04)',
          }}
        >
          {step.screen_moment.snapshot_t && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={snapSrc}
              alt={`Snapshot at ${fmtT(step.screen_moment.snapshot_t)}`}
              style={{
                width: '100%',
                display: 'block',
                marginBottom: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
              }}
            />
          )}

          <div style={{ marginBottom: '10px' }}>
            <div className="label-upper" style={{ marginBottom: '4px' }}>Reason</div>
            <div style={{ fontSize: '12px', color: 'var(--color-ink)', lineHeight: 1.5 }}>
              {step.reason.text}
            </div>
            {step.reason.quote && (
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--color-graphite)',
                  fontStyle: 'italic',
                  marginTop: '4px',
                  paddingLeft: '8px',
                  borderLeft: '2px solid var(--color-border)',
                }}
              >
                &ldquo;{step.reason.quote}&rdquo;
                {step.reason.quote_t !== null && (
                  <span style={{ marginLeft: '4px', fontStyle: 'normal', fontSize: '10px', color: 'var(--color-graphite)' }}>
                    [{fmtT(step.reason.quote_t)}]
                  </span>
                )}
              </div>
            )}
            {step.reason.unconfirmed && (
              <div style={{ fontSize: '10px', color: 'var(--color-graphite)', marginTop: '4px', fontStyle: 'italic' }}>
                Not confirmed by the expert
              </div>
            )}
          </div>

          {step.guardrails.length > 0 && (
            <div>
              <div className="label-upper" style={{ marginBottom: '6px' }}>Guardrails</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {step.guardrails.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      border: '1px solid rgba(245,158,11,0.3)',
                      borderLeft: '2px solid var(--color-flag)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '7px 10px',
                      background: 'var(--color-flag-dim)',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: 'var(--color-flag)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                      {g.kind}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-ink)', lineHeight: 1.4 }}>{g.rule}</div>
                    {g.applies_to && (
                      <div style={{ fontSize: '10px', color: 'var(--color-graphite)', marginTop: '3px' }}>
                        Applies to: {g.applies_to}
                      </div>
                    )}
                    {g.who_to_ask && (
                      <div style={{ fontSize: '10px', color: 'var(--color-graphite)' }}>
                        Ask: {g.who_to_ask}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DebriefPage() {
  const { id } = useParams<{ id: string }>()

  const [phase, setPhase] = useState<DebriefPhase | 'idle' | 'loading'>('idle')
  const [currentGap, setCurrentGap] = useState<Gap | null>(null)
  const [workMap, setWorkMap] = useState<WorkMap | null>(null)
  const [teachbackText, setTeachbackText] = useState<string | null>(null)
  const [gapsAnswered, setGapsAnswered] = useState(0)
  const [totalGaps, setTotalGaps] = useState(0)
  const [moveReason, setMoveReason] = useState<string | null>(null)
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState<TranscriptEntry[]>([])
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [teachbackRounds, setTeachbackRounds] = useState(0)

  const startTimeRef = useRef<number>(0)
  useEffect(() => { startTimeRef.current = Date.now() }, [])
  const isOffRecordRef = useRef(false)
  const pendingAnswerRef = useRef('')
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptBufferRef = useRef<TranscriptEntry[]>([])
  const phaseRef = useRef<DebriefPhase | 'idle' | 'loading'>('idle')
  const sessionIdRef = useRef(id ?? '')
  const sendUserMessageRef = useRef<(msg: string) => void>(() => {})
  const teachbackTextRef = useRef<string | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    teachbackTextRef.current = teachbackText
  }, [teachbackText])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveTranscript])

  const elapsed = useCallback(
    () => (Date.now() - startTimeRef.current) / 1000,
    [],
  )

  const flushTranscript = useCallback(() => {
    const buffer = transcriptBufferRef.current.splice(0)
    if (buffer.length === 0 || !sessionIdRef.current) return
    postTranscriptEntries(sessionIdRef.current, buffer).catch(() => {})
  }, [])

  const handleAnswerFired = useCallback(
    async (answerText: string) => {
      if (!sessionIdRef.current || !answerText.trim()) return
      const p = phaseRef.current
      try {
        if (p === 'gathering') {
          const res = await answerDebrief(sessionIdRef.current, answerText)
          setWorkMap(res.map)
          setGapsAnswered((prev) => prev + 1)
          if (res.teachback) {
            setTeachbackText(res.teachback)
            setPhase('teachback')
            setMoveReason(res.move_reason)
            sendUserMessageRef.current(`[TEACHBACK] ${res.teachback}`)
          } else if (res.next_gap) {
            setCurrentGap(res.next_gap)
            sendUserMessageRef.current(`[ASK] ${res.next_gap.question}`)
          }
        } else if (p === 'teachback') {
          const res = await replyDebrief(sessionIdRef.current, answerText)
          setWorkMap(res.map)
          setTeachbackRounds((prev) => prev + 1)
          if (res.confirmed) {
            setPhase('confirmed')
            setConfirmedAt(res.map.confirmed_at)
          } else if (res.partial_teachback) {
            setTeachbackText(res.partial_teachback)
            sendUserMessageRef.current(`[TEACHBACK] ${res.partial_teachback}`)
          } else {
            const current = teachbackTextRef.current
            if (current) sendUserMessageRef.current(`[TEACHBACK] ${current}`)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Debrief error')
      }
    },
    [],
  )

  const handleAnswerFiredRef = useRef(handleAnswerFired)
  useEffect(() => {
    handleAnswerFiredRef.current = handleAnswerFired
  }, [handleAnswerFired])

  const fireSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      const text = pendingAnswerRef.current.trim()
      pendingAnswerRef.current = ''
      if (text) {
        handleAnswerFiredRef.current(text)
      }
    }, ANSWER_SILENCE_MS)
  }, [])

  const { startSession, endSession, sendUserMessage } = useConversation({
    onConnect: useCallback(() => {
      setIsConnected(true)
    }, []),

    onDisconnect: useCallback(() => {
      setIsConnected(false)
      isOffRecordRef.current = false
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      flushTranscript()
    }, [flushTranscript]),

    onError: useCallback(
      (msg: string) => {
        setError(`Voice error: ${msg}`)
      },
      [],
    ),

    onMessage: useCallback(
      (props: { role: 'user' | 'agent'; message: string }) => {
        if (isOffRecordRef.current) return

        const entry: TranscriptEntry = {
          role: props.role,
          message: props.message,
          t: elapsed(),
          phase: 'debrief',
        }

        if (props.role === 'user') {
          const lower = props.message.toLowerCase()
          if (lower.includes('off the record')) {
            isOffRecordRef.current = true
            return
          }
          if (lower.includes('back on the record')) {
            isOffRecordRef.current = false
          }

          const accumulated = pendingAnswerRef.current
            ? `${pendingAnswerRef.current} ${props.message}`
            : props.message
          pendingAnswerRef.current = accumulated
          fireSilenceTimer()
        }

        setLiveTranscript((prev) => [...prev, entry])
        transcriptBufferRef.current.push(entry)
        if (transcriptBufferRef.current.length >= TRANSCRIPT_FLUSH_MIN) {
          flushTranscript()
        }
      },
      [elapsed, fireSilenceTimer, flushTranscript],
    ),

    onModeChange: useCallback(() => {}, []),
  })

  useEffect(() => {
    sendUserMessageRef.current = sendUserMessage
  }, [sendUserMessage])

  const startDebriefSession = useCallback(async () => {
    if (!id) return
    setPhase('loading')
    setError(null)
    try {
      const signedUrl = await fetchSignedUrl('debrief')
      startSession({ signedUrl })

      const res = await startDebrief(id)
      setWorkMap(res.map)
      setCurrentGap(res.gap)
      setTotalGaps(res.state.total_gaps)
      setPhase('gathering')

      if (res.map.steps.length > 0) {
        setSelectedStepId(res.map.steps[0].id)
      }

      sendUserMessage(`[ASK] ${res.gap.question}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start debrief')
      setPhase('idle')
    }
  }, [id, startSession, sendUserMessage])

  const steps = workMap?.steps ?? []

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', backgroundColor: 'var(--color-paper)' }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-panel)',
          flexShrink: 0,
        }}
        className="flex items-center justify-between px-5 py-3"
      >
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '15px',
            fontWeight: 700,
            background: 'linear-gradient(90deg, var(--color-signal) 0%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          <Link href="/" style={{ textDecoration: 'none' }}>
            The AI Apprentice
          </Link>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href={`/sessions/${id}`}
            style={{ fontSize: '13px', color: 'var(--color-graphite)', textDecoration: 'none' }}
          >
            ← Session
          </Link>
          {phase === 'idle' && (
            <button className="btn-primary" onClick={startDebriefSession}>
              Start debrief
            </button>
          )}
          {isConnected && phase !== 'idle' && phase !== 'loading' && (
            <button className="btn-ghost" onClick={() => endSession()}>
              End
            </button>
          )}
        </div>
      </header>

      {/* Error bar */}
      {error && (
        <div
          style={{
            padding: '8px 20px',
            background: 'rgba(245,158,11,0.08)',
            borderBottom: '1px solid rgba(245,158,11,0.2)',
            fontSize: '12px',
            color: 'var(--color-flag)',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {phase === 'loading' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '2px solid var(--color-border)',
              borderTopColor: 'var(--color-signal)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ fontSize: '13px', color: 'var(--color-graphite)' }}>
            Generating work map&hellip;
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Idle state */}
      {phase === 'idle' && !error && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--color-signal-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
            }}
          >
            🎙
          </div>
          <div style={{ fontSize: '14px', color: 'var(--color-graphite)', textAlign: 'center' }}>
            Ready to start the debrief interview.
          </div>
          <button className="btn-primary" onClick={startDebriefSession}>
            Start debrief
          </button>
        </div>
      )}

      {/* Main two-panel layout */}
      {phase !== 'loading' && phase !== 'idle' && (
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left panel: steps */}
          <div
            style={{
              flex: '0 0 55%',
              borderRight: '1px solid var(--color-border)',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Left panel header */}
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-paper)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--color-ink)',
                  marginBottom: '2px',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {workMap?.process_name ?? 'Building work map…'}
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span className="chip chip-neutral">{steps.length} steps</span>
                <span className="chip chip-flag">
                  {steps.filter((s) => s.is_judgment_call).length} judgment calls
                </span>
                <span className="chip chip-signal">
                  {steps.reduce((n, s) => n + s.guardrails.length, 0)} guardrails
                </span>
              </div>
            </div>

            <div style={{ flex: 1, paddingBottom: '8px' }}>
              {steps.map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  sessionId={id ?? ''}
                  isSelected={selectedStepId === step.id}
                  onSelect={() => setSelectedStepId(step.id)}
                />
              ))}

              {steps.length === 0 && (
                <div style={{ padding: '20px 16px', fontSize: '12px', color: 'var(--color-graphite)' }}>
                  Steps will appear as the debrief progresses.
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div
            style={{
              flex: '0 0 45%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--color-paper)',
            }}
          >
            {phase === 'confirmed' ? (
              /* Confirmed state */
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '32px 24px',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'var(--color-ok-dim)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                  }}
                >
                  ✓
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--color-ok)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  Confirmed by the expert
                </div>
                {confirmedAt && (
                  <div style={{ fontSize: '12px', color: 'var(--color-graphite)' }}>
                    {fmtTimestamp(confirmedAt)}
                  </div>
                )}
                <Link
                  href={`/sessions/${id}/map`}
                  className="btn-primary"
                  style={{ marginTop: '4px', textDecoration: 'none' }}
                >
                  View work map →
                </Link>
              </div>
            ) : (
              <>
                {/* Current question / teachback card */}
                <div style={{ padding: '10px 12px', flexShrink: 0 }}>
                  {phase === 'gathering' && currentGap && (
                    <div
                      style={{
                        background: 'var(--color-signal-dim)',
                        border: '1px solid rgba(61,126,255,0.25)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 14px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '6px',
                        }}
                      >
                        <span className="label-upper" style={{ color: 'var(--color-signal)' }}>
                          Question {gapsAnswered + 1} of {totalGaps}
                        </span>
                        {currentGap.priority === 'high' && (
                          <span className="chip chip-flag" style={{ fontSize: '9px', padding: '1px 5px' }}>
                            high priority
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--color-ink)',
                          lineHeight: 1.5,
                        }}
                      >
                        {currentGap.question}
                      </div>
                    </div>
                  )}

                  {phase === 'teachback' && teachbackText && (
                    <div
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 14px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '6px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span className="label-upper">
                          Teachback · round {teachbackRounds + 1} of 3
                        </span>
                        {moveReason && (
                          <span style={{ fontSize: '11px', color: 'var(--color-graphite)' }}>
                            ({moveReason})
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--color-ink)',
                          lineHeight: 1.6,
                        }}
                      >
                        {teachbackText}
                      </div>
                    </div>
                  )}
                </div>

                {/* Understanding progress bars */}
                {steps.length > 0 && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderTop: '1px solid var(--color-border)',
                      borderBottom: '1px solid var(--color-border)',
                      background: 'var(--color-panel)',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '5px',
                      }}
                    >
                      <span className="label-upper">Understanding</span>
                      <span style={{ fontSize: '10px', color: 'var(--color-graphite)' }}>
                        {gapsAnswered} answered
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {steps.map((s) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              color: 'var(--color-graphite)',
                              width: '72px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            {s.title}
                          </span>
                          <ConfidenceBar confidence={s.confidence} />
                          <span
                            style={{
                              fontSize: '9px',
                              color: s.confidence >= 0.8 ? 'var(--color-signal)' : 'var(--color-flag)',
                              width: '26px',
                              textAlign: 'right',
                              flexShrink: 0,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {Math.round(s.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transcript */}
                <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
                  {liveTranscript.length === 0 && (
                    <div
                      style={{
                        padding: '12px',
                        fontSize: '12px',
                        color: 'var(--color-graphite)',
                        textAlign: 'center',
                      }}
                    >
                      Transcript will appear here.
                    </div>
                  )}
                  {liveTranscript.map((entry, i) => (
                    <div
                      key={i}
                      className="event-entry"
                      style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '5px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '9px',
                          color: 'var(--color-graphite)',
                          flexShrink: 0,
                          paddingTop: '8px',
                          width: '32px',
                          fontVariantNumeric: 'tabular-nums',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {fmtT(entry.t)}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          background:
                            entry.role === 'agent'
                              ? 'var(--color-signal-dim)'
                              : 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '7px 10px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color:
                              entry.role === 'agent'
                                ? 'var(--color-signal)'
                                : 'var(--color-graphite)',
                            marginBottom: '2px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {entry.role === 'agent' ? 'AI' : 'Expert'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-ink)', lineHeight: 1.5 }}>
                          {entry.message}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
