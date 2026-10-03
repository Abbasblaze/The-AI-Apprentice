'use client'

import type { QuestionStats } from '@/lib/types'

interface Props {
  framesSeen: number
  framesSent: number
  framesSkipped: number
  avgLatencyMs: number
  estimatedCostUsd: number
  questionStats: QuestionStats
  visible: boolean
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.0000'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(3)}`
}

function formatLatency(ms: number): string {
  if (ms === 0) return '—'
  return `${Math.round(ms)}ms`
}

export function StatsStrip({
  framesSeen,
  framesSent,
  framesSkipped,
  avgLatencyMs,
  estimatedCostUsd,
  questionStats,
  visible,
}: Props) {
  if (!visible) return null

  return (
    <div
      className="shrink-0 px-4 py-2 text-xs tabular-nums"
      style={{ color: 'var(--color-graphite)', borderTop: '1px solid var(--color-rule)' }}
    >
      Seen {framesSeen} &middot; Sent {framesSent} &middot; Skipped {framesSkipped} &middot; Avg{' '}
      {formatLatency(avgLatencyMs)} &middot; Est. {formatCost(estimatedCostUsd)}
      {questionStats.asked > 0 && (
        <>
          {' '}&middot; Q {questionStats.asked} asked · {questionStats.answered} answered
          {questionStats.guardrail > 0 && (
            <span style={{ color: 'var(--color-flag)' }}>
              {' '}· {questionStats.guardrail} guardrail
            </span>
          )}
        </>
      )}
    </div>
  )
}
