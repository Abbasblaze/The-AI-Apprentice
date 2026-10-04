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
  return (
    <div
      style={{
        height: '3px',
        background: 'var(--color-rule)',
        borderRadius: '2px',
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.round(confidence * 100)}%`,
          background: confidence >= 0.8 ? 'var(--color-signal)' : 'var(--color-flag)',
          transition: 'width 0.3s ease',
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
      style={{
        borderBottom: '1px solid var(--color-rule)',
        borderLeft: isSelected ? '2px solid var(--color-signal)' : '2px solid transparent',
        padding: '12px 16px',
        cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'var(--color-ink)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)' }}>
              {step.title}
            </span>
            {step.is_judgment_call && (
              <span
                style={{
                  fontSize: '10px',
                  fontVariant: 'small-caps',
                  color: 'var(--color-graphite)',
                  letterSpacing: '0.04em',
                }}
              >
                judgment call
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-graphite)', marginBottom: '6px' }}>
            {step.decision}
          </div>
          {isSelected && (
            <div>
              {step.screen_moment.snapshot_t && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={snapSrc}
                  alt={`Snapshot at ${fmtT(step.screen_moment.snapshot_t)}`}
                  style={{
                    width: '100%',
                    display: 'block',
                    marginBottom: '10px',
                    borderTop: '1px solid var(--color-rule)',
                    borderBottom: '1px solid var(--color-rule)',
                  }}
                />
              )}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-graphite)', marginBottom: '2px', fontWeight: 600 }}>
                  Reason
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-ink)' }}>
                  {step.reason.text}
                </div>
                {step.reason.quote && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-graphite)',
                      fontStyle: 'italic',
                      marginTop: '4px',
                    }}
                  >
                    &ldquo;{step.reason.quote}&rdquo;
                    {step.reason.quote_t !== null && (
                      <span style={{ marginLeft: '4px', fontStyle: 'normal', fontSize: '11px' }}>
                        [{fmtT(step.reason.quote_t)}]
                      </span>
                    )}
                  </div>
                )}
                {step.reason.unconfirmed && (
                  <div style={{ fontSize: '11px', color: 'var(--color-graphite)', marginTop: '4px' }}>
                    Not confirmed by the expert
                  </div>
                )}
              </div>
              {step.guardrails.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-graphite)', marginBottom: '4px', fontWeight: 600 }}>
                    Guardrails
                  </div>
                  {step.guardrails.map((g) => (
                    <div
                      key={g.id}
                      style={{
                        borderLeft: '2px solid var(--color-flag)',
                        paddingLeft: '8px',
                        marginBottom: '6px',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--color-flag)', fontWeight: 600, marginBottom: '2px' }}>
                        {g.kind}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-ink)' }}>{g.rule}</div>
                      {g.applies_to && (
                        <div style={{ fontSize: '11px', color: 'var(--color-graphite)' }}>
                          Applies to: {g.applies_to}
                        </div>
                      )}
                      {g.who_to_ask && (
                        <div style={{ fontSize: '11px', color: 'var(--color-graphite)' }}>
                          Ask: {g.who_to_ask}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <ConfidenceBar confidence={step.confidence} />
            <span style={{ fontSize: '10px', color: 'var(--color-graphite)', flexShrink: 0 }}>
              {Math.round(step.confidence * 100)}%
            </span>
          </div>
        </div>
      </div>
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

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    teachbackTextRef.current = teachbackText
  }, [teachbackText])

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link
            href={`/sessions/${id}`}
            className="text-sm"
            style={{ color: 'var(--color-signal)', textDecoration: 'none' }}
          >
            ← Session
          </Link>
          {phase === 'idle' && (
            <button
              onClick={startDebriefSession}
              style={{
                padding: '5px 14px',
                background: 'var(--color-signal)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Start debrief
            </button>
          )}
          {isConnected && phase !== 'idle' && phase !== 'loading' && (
            <button
              onClick={() => endSession()}
              style={{
                padding: '5px 14px',
                background: 'none',
                color: 'var(--color-graphite)',
                border: '1px solid var(--color-rule)',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              End
            </button>
          )}
        </div>
      </header>

      {phase === 'loading' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-graphite)',
            fontSize: '13px',
          }}
        >
          Generating work map&hellip;
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 20px', color: 'var(--color-flag)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {phase !== 'loading' && phase !== 'idle' && (
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div
            style={{
              flex: '0 0 55%',
              borderRight: '1px solid var(--color-rule)',
              overflow: 'auto',
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--color-rule)',
                background: 'var(--color-panel)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '2px' }}>
                {workMap?.process_name ?? 'Building work map…'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-graphite)' }}>
                {steps.length} steps &middot; {steps.filter((s) => s.is_judgment_call).length} judgment calls &middot;{' '}
                {steps.reduce((n, s) => n + s.guardrails.length, 0)} guardrails
              </div>
            </div>

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

          <div
            style={{
              flex: '0 0 45%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {phase === 'confirmed' ? (
              <div style={{ padding: '20px 16px' }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--color-ink)',
                    marginBottom: '4px',
                  }}
                >
                  Confirmed by the expert
                </div>
                {confirmedAt && (
                  <div style={{ fontSize: '12px', color: 'var(--color-graphite)', marginBottom: '12px' }}>
                    {fmtTimestamp(confirmedAt)}
                  </div>
                )}
                <Link
                  href={`/sessions/${id}/map`}
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-signal)',
                    textDecoration: 'none',
                  }}
                >
                  View work map &#x2192;
                </Link>
              </div>
            ) : (
              <>
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--color-rule)',
                    background: 'var(--color-panel)',
                  }}
                >
                  {phase === 'gathering' && currentGap && (
                    <>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--color-graphite)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: '4px',
                        }}
                      >
                        Current question {gapsAnswered + 1} of {totalGaps}
                        {currentGap.priority === 'high' && (
                          <span
                            style={{
                              marginLeft: '8px',
                              color: 'var(--color-flag)',
                            }}
                          >
                            &middot; high priority
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '15px',
                          color: 'var(--color-signal)',
                          fontWeight: 500,
                        }}
                      >
                        {currentGap.question}
                      </div>
                    </>
                  )}
                  {phase === 'teachback' && teachbackText && (
                    <>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--color-graphite)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: '4px',
                        }}
                      >
                        Teachback &middot; round {teachbackRounds + 1} of 3
                        {moveReason && (
                          <span style={{ marginLeft: '8px', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>
                            ({moveReason})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--color-ink)', lineHeight: 1.6 }}>
                        {teachbackText}
                      </div>
                    </>
                  )}
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--color-rule)',
                    background: 'var(--color-panel)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-graphite)',
                      marginBottom: '4px',
                    }}
                  >
                    Understanding
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {steps.map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--color-graphite)', width: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.title}
                        </span>
                        <ConfidenceBar confidence={s.confidence} />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-graphite)', marginTop: '6px' }}>
                    {gapsAnswered} questions answered
                  </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
                  {liveTranscript.map((entry, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '6px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--color-graphite)',
                          flexShrink: 0,
                          paddingTop: '2px',
                          width: '36px',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmtT(entry.t)}
                      </span>
                      <div>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            color: entry.role === 'agent' ? 'var(--color-signal)' : 'var(--color-ink)',
                            marginRight: '4px',
                          }}
                        >
                          {entry.role === 'agent' ? 'AI' : 'Expert'}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--color-ink)' }}>
                          {entry.message}
                        </span>
                      </div>
                    </div>
                  ))}
                  {liveTranscript.length === 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--color-graphite)' }}>
                      Transcript will appear here.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {phase === 'idle' && !error && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '14px', color: 'var(--color-graphite)' }}>
            Ready to start the debrief interview.
          </div>
          <button
            onClick={startDebriefSession}
            style={{
              padding: '8px 20px',
              background: 'var(--color-signal)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Start debrief
          </button>
        </div>
      )}
    </div>
  )
}
