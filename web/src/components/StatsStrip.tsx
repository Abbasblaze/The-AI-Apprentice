'use client'

interface Props {
  framesSeen: number
  framesSent: number
  framesSkipped: number
  avgLatencyMs: number
  estimatedCostUsd: number
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
    </div>
  )
}
