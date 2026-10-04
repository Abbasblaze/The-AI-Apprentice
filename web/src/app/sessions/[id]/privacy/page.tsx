'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { deleteSession, fetchPrivacySummary } from '@/lib/apiClient'
import type { PrivacySummary } from '@/lib/types'

function fmtT(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ─── Redaction pill list ─────────────────────────────────────────────────────

function RedactionPills({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts)
  if (entries.length === 0) {
    return <p style={mutedStyle}>Nothing redacted.</p>
  }

  const max = Math.max(...entries.map(([, c]) => c))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {entries.map(([type, count]) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              minWidth: '120px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-ink-muted)',
              textTransform: 'capitalize',
              letterSpacing: '0.01em',
              flexShrink: 0,
            }}
          >
            {type}
          </span>
          <div
            style={{
              flex: 1,
              height: '6px',
              background: 'var(--color-border)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.round((count / max) * 100)}%`,
                background: 'var(--color-signal)',
                borderRadius: '3px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '12px',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-ink)',
              fontWeight: 600,
              minWidth: '28px',
              textAlign: 'right',
              flexShrink: 0,
            }}
          >
            {count}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Timeline entry ──────────────────────────────────────────────────────────

function TimelineEntry({
  label,
  sublabel,
}: {
  label: string
  sublabel?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        paddingBottom: '10px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-signal)',
            marginTop: '4px',
          }}
        />
        <div
          style={{
            width: '1px',
            flex: 1,
            background: 'var(--color-border)',
            minHeight: '16px',
            marginTop: '3px',
          }}
        />
      </div>
      <div>
        <span style={{ fontSize: '13px', color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
          {label}
        </span>
        {sublabel && (
          <span
            style={{
              marginLeft: '8px',
              fontSize: '12px',
              color: 'var(--color-ink-muted)',
            }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Stat pill ───────────────────────────────────────────────────────────────

function StatPill({ value, label }: { value: number | string; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 16px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        minWidth: '80px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '18px',
          fontWeight: 700,
          color: 'var(--color-ink)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-muted)',
          marginTop: '4px',
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const mutedStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--color-ink-muted)',
}

const sectionHeading: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--color-ink-muted)',
  marginBottom: '12px',
}

function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      className="glass-card"
      style={{
        padding: '20px',
        marginBottom: '12px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const sessionId = params.id

  const [summary, setSummary] = useState<PrivacySummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPrivacySummary(sessionId)
      .then(setSummary)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load privacy summary'),
      )
  }, [sessionId])

  const handleDelete = () => {
    if (!window.confirm('Delete this session and all its data? This cannot be undone.')) {
      return
    }
    deleteSession(sessionId)
      .then(() => router.push('/sessions'))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to delete session'),
      )
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', backgroundColor: 'var(--color-paper)' }}
    >
      {/* Header */}
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
        <Link
          href="/sessions"
          className="text-sm"
          style={{ color: 'var(--color-signal)', textDecoration: 'none' }}
        >
          ← Sessions
        </Link>
      </header>

      <main
        className="flex-1 overflow-auto"
        style={{ padding: '28px 24px', maxWidth: '700px', width: '100%' }}
      >
        {/* Page title */}
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-heading)',
              marginBottom: '4px',
            }}
          >
            Privacy &amp; Data Controls
          </h2>
          <p style={mutedStyle}>
            Review what was captured, redacted, and removed for this session.
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm mb-4" style={{ color: 'var(--color-flag)' }}>
            {error}
          </p>
        )}

        {/* Loading */}
        {summary === null && !error && (
          <p style={mutedStyle}>Loading&hellip;</p>
        )}

        {summary !== null && (
          <>
            {/* ── What was captured ── */}
            <GlassCard>
              <div style={sectionHeading}>What was captured</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <StatPill value={summary.total_events} label="Events" />
                <StatPill value={summary.total_erp_events} label="ERP events" />
                <StatPill value={summary.total_transcript_entries} label="Transcript" />
                <StatPill value={summary.total_snapshots} label="Snapshots" />
              </div>
            </GlassCard>

            {/* ── What was redacted ── */}
            <GlassCard>
              <div style={sectionHeading}>What was redacted</div>
              <RedactionPills counts={summary.redaction_counts} />
              {Object.keys(summary.redaction_by_location).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px' }}>
                  {Object.entries(summary.redaction_by_location).map(([loc, count]) => (
                    <span
                      key={loc}
                      className="chip chip-neutral"
                    >
                      {count} in {loc}
                    </span>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* ── Off the record ── */}
            <GlassCard>
              <div style={sectionHeading}>Off the record</div>
              {summary.off_record_periods.length === 0 ? (
                <p style={mutedStyle}>No off-record periods.</p>
              ) : (
                <div style={{ paddingTop: '2px' }}>
                  {summary.off_record_periods.map((p, idx) => (
                    <TimelineEntry
                      key={idx}
                      label={`${fmtT(p.start_t)} – ${p.end_t === null ? '… (ongoing)' : fmtT(p.end_t)}`}
                      sublabel={
                        p.end_t !== null
                          ? `${Math.round(p.end_t - p.start_t)}s`
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </GlassCard>

            {/* ── Forget that ── */}
            <GlassCard>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={sectionHeading}>Content removed with forget-that</div>
                <button className="btn-ghost" style={{ fontSize: '12px', padding: '4px 10px' }}>
                  Forget that
                </button>
              </div>
              {summary.forget_that_records.length === 0 ? (
                <p style={mutedStyle}>Nothing removed.</p>
              ) : (
                <div style={{ paddingTop: '2px' }}>
                  {summary.forget_that_records.map((r, idx) => (
                    <TimelineEntry
                      key={idx}
                      label={fmtT(r.t)}
                      sublabel={`removed ${r.events_removed} event${r.events_removed !== 1 ? 's' : ''}${r.snapshots_removed > 0 ? `, ${r.snapshots_removed} snapshot${r.snapshots_removed !== 1 ? 's' : ''}` : ''}`}
                    />
                  ))}
                  <div
                    style={{
                      marginTop: '4px',
                      display: 'flex',
                      gap: '8px',
                    }}
                  >
                    <span className="chip chip-neutral">
                      {summary.forget_that_records.length} uses
                    </span>
                    <span className="chip chip-neutral">
                      {summary.forget_that_records.reduce((n, r) => n + r.events_removed, 0)} events removed
                    </span>
                    <span className="chip chip-neutral">
                      {summary.forget_that_records.reduce((n, r) => n + r.snapshots_removed, 0)} snapshots removed
                    </span>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* ── Mask regions ── */}
            <GlassCard>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={sectionHeading}>Masked regions</div>
                <button className="btn-ghost" style={{ fontSize: '12px', padding: '4px 10px' }}>
                  Add mask
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px',
                    padding: '0 10px',
                    borderRadius: '20px',
                    background: summary.mask_region_count > 0
                      ? 'var(--color-signal-dim)'
                      : 'rgba(136,152,179,0.1)',
                    color: summary.mask_region_count > 0
                      ? 'var(--color-signal)'
                      : 'var(--color-ink-muted)',
                    fontSize: '14px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {summary.mask_region_count}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--color-ink-muted)' }}>
                  {summary.mask_region_count === 1 ? 'region masked' : 'regions masked'}
                </span>
              </div>
            </GlassCard>

            {/* ── Delete session ── */}
            <GlassCard
              style={{
                border: '1px solid rgba(239,68,68,0.25)',
                background: 'rgba(239,68,68,0.04)',
              }}
            >
              <div style={sectionHeading}>Danger zone</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '2px' }}>
                    Delete this session
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                    Permanently removes all events, transcripts, and snapshots. Cannot be undone.
                  </div>
                </div>
                <button
                  onClick={handleDelete}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '7px 16px',
                    border: '1px solid rgba(239,68,68,0.6)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#f87171',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.9)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'
                  }}
                >
                  Delete session
                </button>
              </div>
            </GlassCard>
          </>
        )}
      </main>
    </div>
  )
}
