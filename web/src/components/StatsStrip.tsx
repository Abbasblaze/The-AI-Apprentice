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

function Divider() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '1px',
        height: '10px',
        background: 'var(--color-border)',
        margin: '0 8px',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  )
}

interface StatProps {
  label: string
  value: string | number
  valueStyle?: React.CSSProperties
}

function Stat({ label, value, valueStyle }: StatProps) {
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span style={{ color: '#4a5a78' }}>{label}</span>
      <span style={{ color: 'var(--color-border)', margin: '0 3px' }}>·</span>
      <span style={{ color: 'var(--color-ink-muted)', ...valueStyle }}>{value}</span>
    </span>
  )
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
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-paper)',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: '11px',
        lineHeight: '1',
        padding: '0 16px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        overflowY: 'hidden',
        flexShrink: 0,
        scrollbarWidth: 'none',
      }}
    >
      <Stat label="seen" value={framesSeen} />
      <Divider />
      <Stat label="sent" value={framesSent} />
      <Divider />
      <Stat label="skipped" value={framesSkipped} />
      <Divider />
      <Stat label="latency" value={formatLatency(avgLatencyMs)} />
      <Divider />
      <Stat label="cost" value={formatCost(estimatedCostUsd)} />

      {questionStats.asked > 0 && (
        <>
          <Divider />
          <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--color-signal, #3b8dff)',
                flexShrink: 0,
              }}
            />
            <span style={{ color: 'var(--color-graphite)', opacity: 0.7 }}>questions:</span>
            {' '}
            <span style={{ color: 'var(--color-graphite)' }}>
              {questionStats.asked} asked / {questionStats.answered} answered
            </span>
          </span>

          {questionStats.guardrail > 0 && (
            <>
              <Divider />
              <span style={{ whiteSpace: 'nowrap' }}>
                <span style={{ color: 'var(--color-graphite)', opacity: 0.7 }}>guardrails:</span>
                {' '}
                <span style={{ color: '#f5a623' }}>{questionStats.guardrail}</span>
              </span>
            </>
          )}
        </>
      )}
    </div>
  )
}
