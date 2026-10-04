'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { ConversationProvider, useConversationClientTool, useConversationControls } from '@elevenlabs/react'

import { EventLedger } from '@/components/EventLedger'
import { Header } from '@/components/Header'
import { ScreenPreview } from '@/components/ScreenPreview'
import { StatsStrip } from '@/components/StatsStrip'
import { useDirectorLoop } from '@/hooks/useDirectorLoop'
import { useFrameSampler } from '@/hooks/useFrameSampler'
import { useScreenCapture } from '@/hooks/useScreenCapture'
import { useVoiceSession } from '@/hooks/useVoiceSession'
import {
  endSession,
  forgetLastQA,
  postErpEvents,
  postFrame,
  postOffRecordPeriod,
  saveMaskRegions,
} from '@/lib/apiClient'
import { ERP_CHANNEL } from '@/lib/erp/broadcast'
import { BAR_COUNT, calcFilledBars, isUnheardSpeech } from '@/lib/voiceUtils'
import type { ErpBroadcastMessage } from '@/lib/erp/types'
import type {
  AppEvent,
  LedgerEntry,
  MaskRegion,
  QuestionEntry,
  QuestionStats,
  SessionStats,
} from '@/lib/types'

const INPUT_COST_PER_TOKEN = 0.05 / 1_000_000
const OUTPUT_COST_PER_TOKEN = 0.4 / 1_000_000

const TEST_DURATION_MS = 3000

function entryTime(entry: LedgerEntry): number {
  if (entry.type === 'answer' || entry.type === 'forget-that') return entry.t
  if (entry.type === 'off-record-gap') return entry.start_t
  if (entry.type === 'transcript') return entry.t
  return entry.data.t
}

function mergeErpEvents(entries: LedgerEntry[], erpEvents: AppEvent[]): LedgerEntry[] {
  let result = [...entries]
  for (const erpEvent of erpEvents) {
    result = result.filter((entry) => {
      if (entry.type !== 'event') return true
      if (entry.data.source !== 'vision') return true
      if (Math.abs(entry.data.t - erpEvent.t) > 3) return true
      return !(
        entry.data.field !== null &&
        entry.data.field === erpEvent.field &&
        entry.data.from_value === erpEvent.from_value &&
        entry.data.to_value === erpEvent.to_value
      )
    })
    const newEntry: LedgerEntry = { type: 'event', data: erpEvent }
    const idx = result.findIndex((e) => entryTime(e) > erpEvent.t)
    if (idx === -1) result.push(newEntry)
    else result.splice(idx, 0, newEntry)
  }
  return result
}

const INITIAL_STATS: SessionStats = {
  framesSeen: 0,
  framesSent: 0,
  totalLatencyMs: 0,
  requestCount: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
}

const INITIAL_Q_STATS: QuestionStats = { asked: 0, answered: 0, guardrail: 0 }

function LevelMeter({ level }: { level: number }) {
  const filled = calcFilledBars(level, BAR_COUNT)
  return (
    <div style={{ display: 'flex', gap: '1px', alignItems: 'center', height: '10px' }}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: '2px',
            height: '10px',
            backgroundColor: i < filled ? 'var(--color-signal)' : 'var(--color-border)',
            transition: 'background-color 0.05s',
          }}
        />
      ))}
    </div>
  )
}

interface VoiceCheckPanelProps {
  isConnected: boolean
  voiceMode: string
  lastUserSpeechMs: number
  lastUserTranscriptMs: number
  lastUserTranscriptText: string
}

function VoiceCheckPanel({
  isConnected,
  voiceMode,
  lastUserSpeechMs,
  lastUserTranscriptMs,
  lastUserTranscriptText,
}: VoiceCheckPanelProps) {
  const { getInputVolume } = useConversationControls()
  const [level, setLevel] = useState(0)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!isConnected) return
    const tick = () => {
      setLevel(getInputVolume())
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      setLevel(0)
    }
  }, [isConnected, getInputVolume])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  const runTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.frequencyBinCount)
      let peak = 0
      const start = Date.now()

      await new Promise<void>((resolve) => {
        const tick = () => {
          analyser.getByteFrequencyData(buf)
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length
          if (avg > peak) peak = avg
          if (Date.now() - start < TEST_DURATION_MS) requestAnimationFrame(tick)
          else resolve()
        }
        requestAnimationFrame(tick)
      })

      stream.getTracks().forEach((t) => t.stop())
      await ctx.close()
      setTestResult(
        peak > 5
          ? 'Sound detected'
          : 'No sound detected. Check your input device and browser permission.',
      )
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setTestResult('Microphone access denied. Allow microphone access in your browser.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setTestResult('No microphone found. Connect a microphone and try again.')
      } else {
        setTestResult('Error: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
    setTesting(false)
  }, [])

  const showUnheard = isUnheardSpeech(isConnected, lastUserSpeechMs, lastUserTranscriptMs, now)

  const statusText = isConnected
    ? voiceMode === 'idle'
      ? 'connected'
      : voiceMode
    : 'not connected'

  return (
    <div
      style={{
        borderTop: '1px solid var(--color-border)',
        padding: '8px 16px',
        fontSize: '12px',
        color: 'var(--color-ink-muted)',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-muted)',
          marginBottom: '6px',
        }}
      >
        Voice check
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
        <span style={{ flexShrink: 0 }}>Mic</span>
        <LevelMeter level={level} />
        <span
          style={{
            flexShrink: 0,
            color: isConnected ? 'var(--color-signal)' : 'var(--color-ink-muted)',
          }}
        >
          {statusText}
        </span>
      </div>

      {lastUserTranscriptText && (
        <div
          style={{
            marginBottom: '5px',
            color: 'var(--color-ink-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
        >
          <span style={{ color: 'var(--color-ink-muted)', marginRight: '4px' }}>Last heard:</span>
          <span style={{ color: 'var(--color-ink)' }}>{lastUserTranscriptText}</span>
        </div>
      )}

      {showUnheard && (
        <div
          style={{
            marginBottom: '5px',
            color: 'var(--color-flag)',
            lineHeight: 1.4,
          }}
        >
          The agent has not received your speech yet. Check your microphone input device
          and browser permission, or refresh the page.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={runTest}
          disabled={testing}
          style={{
            fontSize: '11px',
            padding: '3px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            background: 'transparent',
            color: 'var(--color-ink-muted)',
            cursor: testing ? 'wait' : 'pointer',
            opacity: testing ? 0.6 : 1,
          }}
        >
          {testing ? `Testing… ${Math.ceil(TEST_DURATION_MS / 1000)}s` : 'Test microphone'}
        </button>
        {testResult && (
          <span
            style={{
              color: testResult.startsWith('Sound detected')
                ? 'var(--color-ok)'
                : 'var(--color-flag)',
            }}
          >
            {testResult}
          </span>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <ConversationProvider>
      <PageContent />
    </ConversationProvider>
  )
}

function PageContent() {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [stats, setStats] = useState<SessionStats>(INITIAL_STATS)
  const [qStats, setQStats] = useState<QuestionStats>(INITIAL_Q_STATS)
  const [apiError, setApiError] = useState<string | null>(null)
  const [lastScreenChangeMs, setLastScreenChangeMs] = useState(0)
  const [lastQuestionAskedMs, setLastQuestionAskedMs] = useState(0)
  const [maskRegions, setMaskRegions] = useState<MaskRegion[]>([])

  const sessionIdRef = useRef<string>('')
  const startTimeRef = useRef<number>(0)
  const inFlightRef = useRef(false)
  const eventsRef = useRef<AppEvent[]>([])
  const lastQuestionAskedMsRef = useRef(0)
  const isOffRecordRef = useRef(false)
  const openGapIdRef = useRef<string | null>(null)
  const openGapStartRef = useRef<number>(0)

  const handleVoiceError = useCallback((msg: string) => setApiError(msg), [])

  const handleOffRecordChange = useCallback((offRecord: boolean, t: number) => {
    if (offRecord) {
      const id = crypto.randomUUID()
      openGapIdRef.current = id
      openGapStartRef.current = t
      setEntries((prev) => [
        ...prev,
        { type: 'off-record-gap', id, start_t: t, end_t: null },
      ])
    } else {
      const id = openGapIdRef.current
      const start = openGapStartRef.current
      openGapIdRef.current = null
      if (id) {
        setEntries((prev) =>
          prev.map((e) =>
            e.type === 'off-record-gap' && e.id === id ? { ...e, end_t: t } : e,
          ),
        )
      }
      if (sessionIdRef.current) {
        postOffRecordPeriod(sessionIdRef.current, start, t).catch(() => {})
      }
    }
  }, [])

  const handleForgetThat = useCallback(() => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    forgetLastQA(sessionId)
      .then((record) => {
        setEntries((prev) => [
          ...prev,
          {
            type: 'forget-that',
            id: crypto.randomUUID(),
            t: record.t,
            events_removed: record.events_removed,
            snapshots_removed: record.snapshots_removed,
          },
        ])
      })
      .catch(() => {})
  }, [])

  const handleAnswered = useCallback((questionId: string, answerText: string) => {
    const t = (Date.now() - startTimeRef.current) / 1000
    setEntries((prev) => [
      ...prev,
      { type: 'answer', id: crypto.randomUUID(), t, questionId, text: answerText },
    ])
    setQStats((prev) => ({ ...prev, answered: prev.answered + 1 }))
  }, [])

  const handleScreenStop = useCallback(() => {
    inFlightRef.current = false
  }, [])

  const { videoRef, isSharing, error: captureError, startSharing, stopSharing } =
    useScreenCapture(handleScreenStop)

  const {
    isConnected,
    voiceMode,
    isOffRecord,
    isPendingAnswer,
    lastUserSpeechMs,
    lastUserTranscriptMs,
    lastUserTranscriptText,
    checkMic,
    startVoice,
    stopVoice,
    pushScreenEvents,
    sendDirectorQuestion,
    toggleOffRecord,
    confirmForget,
  } = useVoiceSession({
    sessionIdRef,
    startTimeRef,
    onError: handleVoiceError,
    onAnswered: handleAnswered,
    onOffRecordChange: handleOffRecordChange,
    onForgetThat: handleForgetThat,
  })

  useEffect(() => {
    isOffRecordRef.current = isOffRecord
  })

  useEffect(() => {
    if (!isSharing) return
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        toggleOffRecord()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isSharing, toggleOffRecord])

  const handleMaskRegionsChange = useCallback((regions: MaskRegion[]) => {
    setMaskRegions(regions)
    if (sessionIdRef.current) {
      saveMaskRegions(sessionIdRef.current, regions).catch(() => {})
    }
  }, [])

  const handleForgetButton = useCallback(() => {
    handleForgetThat()
    confirmForget()
  }, [handleForgetThat, confirmForget])

  useEffect(() => {
    const channel = new BroadcastChannel(ERP_CHANNEL)
    channel.onmessage = (event: MessageEvent<ErpBroadcastMessage>) => {
      const msg = event.data
      if (msg.type !== 'erp-events') return
      const sessionId = sessionIdRef.current
      if (!sessionId || isOffRecordRef.current) return

      const t0 = startTimeRef.current
      const erpEvents: AppEvent[] = msg.events.map((e) => ({
        id: crypto.randomUUID(),
        t: (e.wallMs - t0) / 1000,
        kind: e.kind,
        subject: e.subject,
        field: e.field,
        from_value: e.from_value,
        to_value: e.to_value,
        summary: e.summary,
        source: 'erp' as const,
      }))

      eventsRef.current = [...eventsRef.current, ...erpEvents]
      setEntries((prev) => mergeErpEvents(prev, erpEvents))
      setLastScreenChangeMs(Date.now())

      postErpEvents(sessionId, erpEvents).catch(() => {})
      pushScreenEvents(erpEvents)
    }
    return () => channel.close()
  }, [pushScreenEvents])

  useConversationClientTool('get_recent_screen_events', () => {
    const recent = eventsRef.current.slice(-10)
    if (recent.length === 0) return 'No events yet.'
    return recent
      .map(
        (e) =>
          `[${e.t.toFixed(1)}s] ${e.kind}: ${e.summary}` +
          (e.field ? ` (${e.field})` : ''),
      )
      .join('\n')
  })

  const handleQuestion = useCallback((entry: QuestionEntry) => {
    const now = Date.now()
    lastQuestionAskedMsRef.current = now
    setLastQuestionAskedMs(now)
    setEntries((prev) => [...prev, { type: 'question', data: entry }])
    setQStats((prev) => ({
      asked: prev.asked + 1,
      answered: prev.answered,
      guardrail: entry.kind === 'guardrail' ? prev.guardrail + 1 : prev.guardrail,
    }))
  }, [])

  const handleSample = useCallback(
    (imageB64: string | null) => {
      setStats((prev) => ({ ...prev, framesSeen: prev.framesSeen + 1 }))

      if (imageB64 !== null) {
        setLastScreenChangeMs(Date.now())
      }

      if (imageB64 === null || inFlightRef.current || isOffRecord) return

      inFlightRef.current = true
      const t = (Date.now() - startTimeRef.current) / 1000

      setStats((prev) => ({ ...prev, framesSent: prev.framesSent + 1 }))

      postFrame({ session_id: sessionIdRef.current, t, image: imageB64 })
        .then((result) => {
          if (result.events.length > 0) {
            eventsRef.current = [...eventsRef.current, ...result.events]
            setEntries((prev) => [
              ...prev,
              ...result.events.map((e): LedgerEntry => ({ type: 'event', data: e })),
            ])
            pushScreenEvents(result.events)
          }
          setStats((prev) => ({
            ...prev,
            totalLatencyMs: prev.totalLatencyMs + result.latency_ms,
            requestCount: prev.requestCount + 1,
            totalInputTokens: prev.totalInputTokens + result.usage.input_tokens,
            totalOutputTokens: prev.totalOutputTokens + result.usage.output_tokens,
          }))
        })
        .catch((err: unknown) => {
          setApiError(err instanceof Error ? err.message : 'API request failed')
        })
        .finally(() => {
          inFlightRef.current = false
        })
    },
    [isOffRecord, pushScreenEvents],
  )

  useFrameSampler({
    videoRef,
    enabled: isSharing && !isOffRecord,
    onSample: handleSample,
    maskRegions,
  })

  useDirectorLoop({
    sessionIdRef,
    enabled: isSharing && isConnected,
    isOffRecord,
    isSpeaking: voiceMode === 'speaking',
    isPendingAnswer,
    lastScreenChangeMs,
    lastUserSpeechMs,
    lastQuestionAskedMs,
    startTimeRef,
    onQuestion: handleQuestion,
    sendDirectorQuestion,
  })

  const handleStart = useCallback(async () => {
    const micErr = await checkMic()
    if (micErr) {
      setApiError(micErr)
      return
    }

    sessionIdRef.current = crypto.randomUUID()
    startTimeRef.current = Date.now()
    inFlightRef.current = false
    eventsRef.current = []
    lastQuestionAskedMsRef.current = 0
    setEntries([])
    setStats(INITIAL_STATS)
    setQStats(INITIAL_Q_STATS)
    setApiError(null)
    setLastScreenChangeMs(0)
    setLastQuestionAskedMs(0)
    setMaskRegions([])
    openGapIdRef.current = null
    await startSharing()
    await startVoice()
  }, [checkMic, startSharing, startVoice])

  const handleStop = useCallback(() => {
    stopSharing()
    stopVoice()
    inFlightRef.current = false
    if (sessionIdRef.current) {
      endSession(sessionIdRef.current).catch(() => {})
    }
  }, [stopSharing, stopVoice])

  const estimatedCostUsd =
    stats.totalInputTokens * INPUT_COST_PER_TOKEN +
    stats.totalOutputTokens * OUTPUT_COST_PER_TOKEN

  const avgLatencyMs =
    stats.requestCount > 0 ? stats.totalLatencyMs / stats.requestCount : 0

  const framesSkipped = Math.max(0, stats.framesSeen - stats.framesSent)
  const statsVisible = isSharing || stats.framesSeen > 0
  const displayError = captureError ?? apiError

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', backgroundColor: 'var(--color-paper)' }}
    >
      <Header
        isSharing={isSharing}
        startTimeRef={startTimeRef}
        voiceMode={voiceMode}
        isOffRecord={isOffRecord}
      />

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
        <main
          className="flex flex-col flex-1 overflow-hidden min-w-0"
          style={{ borderRight: '1px solid var(--color-rule)' }}
        >
          <div
            className="flex-1 overflow-hidden"
            style={{ border: '1px solid var(--color-rule)', margin: '0' }}
          >
            <ScreenPreview
              videoRef={videoRef}
              isSharing={isSharing}
              maskRegions={maskRegions}
              onMaskRegionsChange={handleMaskRegionsChange}
            />
          </div>

          <div className="shrink-0 px-4 py-2 flex items-center gap-4 min-h-[40px]">
            {!isSharing ? (
              <button
                onClick={handleStart}
                className="px-4 py-1.5 text-sm font-medium text-white"
                style={{
                  backgroundColor: 'var(--color-signal)',
                  borderRadius: '4px',
                }}
              >
                Start sharing
              </button>
            ) : (
              <>
                <button
                  onClick={handleStop}
                  className="px-3 py-1.5 text-sm font-medium"
                  style={{
                    border: '1px solid var(--color-rule)',
                    borderRadius: '4px',
                    color: 'var(--color-graphite)',
                  }}
                >
                  Stop sharing
                </button>
                <button
                  onClick={toggleOffRecord}
                  className="px-3 py-1.5 text-sm font-medium"
                  style={{
                    border: '1px solid var(--color-graphite)',
                    borderRadius: '4px',
                    color: 'var(--color-graphite)',
                  }}
                >
                  {isOffRecord ? 'Resume recording' : 'Off the record'}
                </button>
                {!isOffRecord && (
                  <button
                    onClick={handleForgetButton}
                    className="px-3 py-1.5 text-sm font-medium"
                    style={{
                      border: '1px solid var(--color-graphite)',
                      borderRadius: '4px',
                      color: 'var(--color-graphite)',
                    }}
                  >
                    Forget that
                  </button>
                )}
              </>
            )}

            {displayError && (
              <p className="text-sm" style={{ color: 'var(--color-flag)' }}>
                {displayError}
              </p>
            )}
          </div>

          <VoiceCheckPanel
            isConnected={isConnected}
            voiceMode={voiceMode}
            lastUserSpeechMs={lastUserSpeechMs}
            lastUserTranscriptMs={lastUserTranscriptMs}
            lastUserTranscriptText={lastUserTranscriptText}
          />

          <StatsStrip
            framesSeen={stats.framesSeen}
            framesSent={stats.framesSent}
            framesSkipped={framesSkipped}
            avgLatencyMs={avgLatencyMs}
            estimatedCostUsd={estimatedCostUsd}
            questionStats={qStats}
            visible={statsVisible}
          />
        </main>

        <aside
          className="flex flex-col overflow-hidden shrink-0"
          style={{ width: '320px' }}
        >
          <EventLedger entries={entries} />
        </aside>
      </div>
    </div>
  )
}
