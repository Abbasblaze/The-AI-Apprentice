'use client'

import { useCallback, useRef, useState } from 'react'

import { EventLedger } from '@/components/EventLedger'
import { Header } from '@/components/Header'
import { ScreenPreview } from '@/components/ScreenPreview'
import { StatsStrip } from '@/components/StatsStrip'
import { useFrameSampler } from '@/hooks/useFrameSampler'
import { useScreenCapture } from '@/hooks/useScreenCapture'
import { postFrame } from '@/lib/apiClient'
import type { AppEvent, SessionStats } from '@/lib/types'

const INPUT_COST_PER_TOKEN = 0.05 / 1_000_000
const OUTPUT_COST_PER_TOKEN = 0.4 / 1_000_000

const INITIAL_STATS: SessionStats = {
  framesSeen: 0,
  framesSent: 0,
  totalLatencyMs: 0,
  requestCount: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
}

export default function Page() {
  const [events, setEvents] = useState<AppEvent[]>([])
  const [stats, setStats] = useState<SessionStats>(INITIAL_STATS)
  const [apiError, setApiError] = useState<string | null>(null)

  const sessionIdRef = useRef<string>('')
  const startTimeRef = useRef<number>(0)
  const inFlightRef = useRef(false)

  const handleStop = useCallback(() => {
    inFlightRef.current = false
  }, [])

  const { videoRef, isSharing, error: captureError, startSharing, stopSharing } =
    useScreenCapture(handleStop)

  const handleSample = useCallback((imageB64: string | null) => {
    setStats((prev) => ({ ...prev, framesSeen: prev.framesSeen + 1 }))

    if (imageB64 === null || inFlightRef.current) return

    inFlightRef.current = true
    const t = (Date.now() - startTimeRef.current) / 1000

    setStats((prev) => ({ ...prev, framesSent: prev.framesSent + 1 }))

    postFrame({ session_id: sessionIdRef.current, t, image: imageB64 })
      .then((result) => {
        if (result.events.length > 0) {
          setEvents((prev) => [...prev, ...result.events])
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
  }, [])

  useFrameSampler({
    videoRef,
    enabled: isSharing,
    onSample: handleSample,
  })

  const handleStart = useCallback(async () => {
    sessionIdRef.current = crypto.randomUUID()
    startTimeRef.current = Date.now()
    inFlightRef.current = false
    setEvents([])
    setStats(INITIAL_STATS)
    setApiError(null)
    await startSharing()
  }, [startSharing])

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
      <Header isSharing={isSharing} startTimeRef={startTimeRef} />

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
                onClick={stopSharing}
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
            visible={statsVisible}
          />
        </main>

        <aside
          className="flex flex-col overflow-hidden shrink-0"
          style={{ width: '320px' }}
        >
          <EventLedger events={events} />
        </aside>
      </div>
    </div>
  )
}
