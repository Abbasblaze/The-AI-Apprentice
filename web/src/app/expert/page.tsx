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
import { BAR_COUNT, MIC_LEVEL_THRESHOLD, calcFilledBars, shouldWarnNoTranscript } from '@/lib/voiceUtils'
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

interface VoiceStatusBarProps {
  isConnected: boolean
  voiceMode: string
  permission: PermissionState
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
  onDeviceChange: (id: string) => void
  lastTranscriptMs: number
  lastTranscriptText: string
}

function VoiceStatusBar({
  isConnected,
  voiceMode,
  permission,
  devices,
  selectedDeviceId,
  onDeviceChange,
  lastTranscriptMs,
  lastTranscriptText,
}: VoiceStatusBarProps) {
  const { getInputVolume } = useConversationControls()
  const [level, setLevel] = useState(0)
  const [showNoTranscript, setShowNoTranscript] = useState(false)
  const micActiveRef = useRef(0)
  const lastSilentRef = useRef(0)
  const lastTranscriptMsRef = useRef(lastTranscriptMs)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    lastTranscriptMsRef.current = lastTranscriptMs
  }, [lastTranscriptMs])

  useEffect(() => {
    if (!isConnected) return
    const tick = () => {
      const v = getInputVolume()
      const now = Date.now()
      setLevel(v)
      if (v > MIC_LEVEL_THRESHOLD) {
        lastSilentRef.current = 0
        if (micActiveRef.current === 0) micActiveRef.current = now
      } else {
        if (lastSilentRef.current === 0) lastSilentRef.current = now
        if (now - lastSilentRef.current > 500) micActiveRef.current = 0
      }
      setShowNoTranscript(
        shouldWarnNoTranscript(true, micActiveRef.current, lastTranscriptMsRef.current, now),
      )
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      setLevel(0)
      setShowNoTranscript(false)
      micActiveRef.current = 0
      lastSilentRef.current = 0
    }
  }, [isConnected, getInputVolume])

  const filled = calcFilledBars(level, BAR_COUNT)

  return (
    <div
      style={{
        height: '36px',
        padding: '0 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'var(--color-panel)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <span
        className={`chip ${
          permission === 'granted'
            ? 'chip-ok'
            : permission === 'denied'
              ? 'chip-flag'
              : 'chip-neutral'
        }`}
        style={{ fontSize: '11px', flexShrink: 0 }}
      >
        {permission === 'granted' ? 'mic on' : permission === 'denied' ? 'mic blocked' : 'mic —'}
      </span>

      <span
        className={`chip ${isConnected ? 'chip-ok' : 'chip-neutral'}`}
        style={{ fontSize: '11px', flexShrink: 0 }}
      >
        {isConnected ? voiceMode : 'not connected'}
      </span>

      {devices.length > 0 && (
        <select
          value={selectedDeviceId}
          onChange={(e) => onDeviceChange(e.target.value)}
          disabled={isConnected}
          style={{
            fontSize: '11px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            color: isConnected ? 'var(--color-ink-muted)' : 'var(--color-ink)',
            padding: '2px 6px',
            cursor: isConnected ? 'default' : 'pointer',
            maxWidth: '180px',
          }}
        >
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone (${d.deviceId.slice(0, 6)})`}
            </option>
          ))}
        </select>
      )}

      {isConnected && (
        <div style={{ display: 'flex', gap: '1px', alignItems: 'center', flexShrink: 0 }}>
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                width: '2px',
                height: '10px',
                backgroundColor: i < filled ? 'var(--color-signal)' : 'var(--color-border)',
              }}
            />
          ))}
        </div>
      )}

      {lastTranscriptText && (
        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-ink-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          heard: {lastTranscriptText}
        </span>
      )}

      {showNoTranscript && (
        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-flag)',
            flexShrink: 0,
          }}
        >
          The agent has not received your speech yet — check the input device and Turn V3 sensitivity in the ElevenLabs agent settings.
        </span>
      )}
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
  const [permission, setPermission] = useState<PermissionState>('prompt')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('elevenlabs-input-device-id') ?? '') : '',
  )

  const sessionIdRef = useRef<string>('')
  const startTimeRef = useRef<number>(0)
  const inFlightRef = useRef(false)
  const eventsRef = useRef<AppEvent[]>([])
  const lastQuestionAskedMsRef = useRef(0)
  const isOffRecordRef = useRef(false)
  const openGapIdRef = useRef<string | null>(null)
  const openGapStartRef = useRef<number>(0)

  const handleDeviceChange = useCallback((id: string) => {
    setSelectedDeviceId(id)
    localStorage.setItem('elevenlabs-input-device-id', id)
  }, [])

  const enumerateAudioInputs = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const inputs = all.filter((d) => d.kind === 'audioinput')
      setDevices(inputs)
      if (inputs.length > 0) {
        setSelectedDeviceId((prev) => {
          if (prev) return prev
          const stored = localStorage.getItem('elevenlabs-input-device-id') ?? ''
          return stored || inputs[0].deviceId
        })
      }
    } catch (_) {}
  }, [])

  useEffect(() => {
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        setPermission(status.state)
        if (status.state === 'granted') void enumerateAudioInputs()
        status.addEventListener('change', () => {
          setPermission(status.state)
          if (status.state === 'granted') void enumerateAudioInputs()
        })
      })
      .catch(() => {})
  }, [enumerateAudioInputs])

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
    startVoice,
    stopVoice,
    pushScreenEvents,
    sendDirectorQuestion,
    toggleOffRecord,
    confirmForget,
  } = useVoiceSession({
    sessionIdRef,
    startTimeRef,
    deviceId: selectedDeviceId || undefined,
    onError: handleVoiceError,
    onAnswered: handleAnswered,
    onOffRecordChange: handleOffRecordChange,
    onForgetThat: handleForgetThat,
    onAnswerTimeout: useCallback(() => {
      setLastQuestionAskedMs(Date.now())
    }, []),
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
    let probeStream: MediaStream | null = null
    try {
      probeStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
        },
      })
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPermission('denied')
        setApiError('Microphone access denied. Allow microphone access in your browser and try again.')
        return
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setApiError('No microphone found. Connect a microphone and try again.')
        return
      }
      setApiError(`Microphone unavailable: ${err instanceof Error ? err.message : String(err)}`)
      return
    } finally {
      probeStream?.getTracks().forEach((t) => t.stop())
    }
    setPermission('granted')
    await enumerateAudioInputs()

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
  }, [selectedDeviceId, enumerateAudioInputs, startSharing, startVoice])

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
      <VoiceStatusBar
        isConnected={isConnected}
        voiceMode={voiceMode}
        permission={permission}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onDeviceChange={handleDeviceChange}
        lastTranscriptMs={lastUserTranscriptMs}
        lastTranscriptText={lastUserTranscriptText}
      />

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
        <main
          className="flex flex-col flex-1 overflow-hidden min-w-0"
          style={{ borderRight: '1px solid var(--color-border)' }}
        >
          <div
            className="flex-1 overflow-hidden"
            style={{ padding: '14px 16px 0' }}
          >
            <ScreenPreview
              videoRef={videoRef}
              isSharing={isSharing}
              maskRegions={maskRegions}
              onMaskRegionsChange={handleMaskRegionsChange}
            />
          </div>

          <div
            className="shrink-0 flex items-center gap-2"
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-panel)',
              minHeight: '52px',
            }}
          >
            {!isSharing ? (
              <button onClick={handleStart} className="btn-primary">
                Start sharing
              </button>
            ) : (
              <>
                <button onClick={handleStop} className="btn-ghost">
                  Stop sharing
                </button>
                <button
                  onClick={toggleOffRecord}
                  className="btn-ghost"
                  style={
                    isOffRecord
                      ? {
                          borderColor: 'var(--color-flag)',
                          color: 'var(--color-flag)',
                          background: 'var(--color-flag-dim)',
                        }
                      : {}
                  }
                >
                  {isOffRecord ? 'Resume recording' : 'Off the record'}
                </button>
                {!isOffRecord && (
                  <button onClick={handleForgetButton} className="btn-ghost">
                    Forget that
                  </button>
                )}
              </>
            )}
            {displayError && (
              <p
                className="text-sm"
                style={{ color: 'var(--color-flag)', marginLeft: 'auto' }}
              >
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
          style={{ width: '340px' }}
        >
          <EventLedger entries={entries} />
        </aside>
      </div>
    </div>
  )
}
