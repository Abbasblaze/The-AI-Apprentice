'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { ConversationProvider, useConversationClientTool } from '@elevenlabs/react'

import { EventLedger } from '@/components/EventLedger'
import { Header } from '@/components/Header'
import { ScreenPreview } from '@/components/ScreenPreview'
import { StatsStrip } from '@/components/StatsStrip'
import { useDirectorLoop } from '@/hooks/useDirectorLoop'
import { useFrameSampler } from '@/hooks/useFrameSampler'
import { useScreenCapture } from '@/hooks/useScreenCapture'
import { useVoiceSession } from '@/hooks/useVoiceSession'
import { endSession, postErpEvents, postFrame } from '@/lib/apiClient'
import { ERP_CHANNEL } from '@/lib/erp/broadcast'
import type { ErpBroadcastMessage } from '@/lib/erp/types'
import type {
  AppEvent,
  LedgerEntry,
  QuestionEntry,
  QuestionStats,
  SessionStats,
} from '@/lib/types'

const INPUT_COST_PER_TOKEN = 0.05 / 1_000_000
const OUTPUT_COST_PER_TOKEN = 0.4 / 1_000_000

function entryTime(entry: LedgerEntry): number {
  return entry.type === 'answer' ? entry.t : entry.data.t
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

  const sessionIdRef = useRef<string>('')
  const startTimeRef = useRef<number>(0)
  const inFlightRef = useRef(false)
  const eventsRef = useRef<AppEvent[]>([])
  const lastQuestionAskedMsRef = useRef(0)
  const isOffRecordRef = useRef(false)

  const handleVoiceError = useCallback((msg: string) => setApiError(msg), [])

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
    startVoice,
    stopVoice,
    pushScreenEvents,
    sendDirectorQuestion,
  } = useVoiceSession({
    sessionIdRef,
    startTimeRef,
    onError: handleVoiceError,
    onAnswered: handleAnswered,
  })

  useEffect(() => {
    isOffRecordRef.current = isOffRecord
  })

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
    await startSharing()
    await startVoice()
  }, [startSharing, startVoice])

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
            <ScreenPreview videoRef={videoRef} isSharing={isSharing} />
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
            )}

            {displayError && (
              <p className="text-sm" style={{ color: 'var(--color-flag)' }}>
                {displayError}
              </p>
            )}
          </div>

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
