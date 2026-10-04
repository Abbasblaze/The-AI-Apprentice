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

const sectionTitle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-graphite)',
  fontFamily: 'var(--font-heading)',
  marginBottom: '8px',
  marginTop: '28px',
}

const body: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--color-ink)',
}

const muted: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--color-graphite)',
}

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

      <main className="flex-1 overflow-auto px-6 py-5" style={{ maxWidth: '680px' }}>
        <h2
          className="text-sm font-medium"
          style={{ color: 'var(--color-graphite)', fontFamily: 'var(--font-heading)' }}
        >
          Privacy
        </h2>

        {error && (
          <p className="text-sm mt-3" style={{ color: 'var(--color-flag)' }}>
            {error}
          </p>
        )}

        {summary === null && !error && (
          <p className="text-sm mt-3" style={muted}>
            Loading…
          </p>
        )}

        {summary !== null && (
          <>
            <div style={sectionTitle}>What was captured</div>
            <p style={body}>
              {summary.total_events} events · {summary.total_erp_events} ERP events ·{' '}
              {summary.total_transcript_entries} transcript entries ·{' '}
              {summary.total_snapshots} snapshots
            </p>

            <div style={sectionTitle}>What was redacted</div>
            {Object.keys(summary.redaction_counts).length === 0 ? (
              <p style={muted}>Nothing redacted.</p>
            ) : (
              <table style={{ borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-rule)' }}>
                    <th style={th}>Type</th>
                    <th style={th}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.redaction_counts).map(([type, count]) => (
                    <tr key={type} style={{ borderBottom: '1px solid var(--color-rule)' }}>
                      <td style={td}>{type}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {Object.keys(summary.redaction_by_location).length > 0 && (
              <p style={{ ...muted, marginTop: '8px' }}>
                {Object.entries(summary.redaction_by_location)
                  .map(([loc, count]) => `${count} in ${loc}`)
                  .join(' · ')}
              </p>
            )}

            <div style={sectionTitle}>Off the record</div>
            {summary.off_record_periods.length === 0 ? (
              <p style={muted}>No off-record periods</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {summary.off_record_periods.map((p, idx) => (
                  <li key={idx} style={{ ...body, marginBottom: '4px' }}>
                    {fmtT(p.start_t)}–{p.end_t === null ? '… (ongoing)' : fmtT(p.end_t)}
                  </li>
                ))}
              </ul>
            )}

            <div style={sectionTitle}>Masked regions</div>
            <p style={body}>{summary.mask_region_count} regions masked</p>

            <div style={sectionTitle}>Content removed with forget that</div>
            {summary.forget_that_records.length === 0 ? (
              <p style={muted}>Nothing removed</p>
            ) : (
              <p style={body}>
                {summary.forget_that_records.length} times ·{' '}
                {summary.forget_that_records.reduce((n, r) => n + r.events_removed, 0)} events
                removed ·{' '}
                {summary.forget_that_records.reduce((n, r) => n + r.snapshots_removed, 0)}{' '}
                snapshots removed total
              </p>
            )}

            <div style={sectionTitle}>Delete this session</div>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm font-medium"
              style={{
                border: '1px solid var(--color-flag)',
                borderRadius: '4px',
                color: 'var(--color-flag)',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              Delete session
            </button>
          </>
        )}
      </main>
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '6px 16px 6px 0',
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--color-graphite)',
  fontSize: '12px',
}

const td: React.CSSProperties = {
  padding: '6px 16px 6px 0',
  color: 'var(--color-ink)',
}
