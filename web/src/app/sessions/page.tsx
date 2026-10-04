'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { fetchSessions } from '@/lib/apiClient'
import type { SessionSummary } from '@/lib/types'

function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(start: number, end: number | null): string {
  const secs = Math.round((end ? end - start : Date.now() / 1000 - start))
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load sessions'),
      )
  }, [])

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
          Sessions
        </Link>
      </header>

      <main className="flex-1 overflow-auto px-6 py-5">
        <h2
          className="text-sm font-medium mb-4"
          style={{ color: 'var(--color-graphite)', fontFamily: 'var(--font-heading)' }}
        >
          Session Library
        </h2>

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-flag)' }}>
            {error}
          </p>
        )}

        {sessions === null && !error && (
          <p className="text-sm" style={{ color: 'var(--color-graphite)' }}>
            Loading…
          </p>
        )}

        {sessions !== null && sessions.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--color-graphite)' }}>
            No sessions recorded yet.
          </p>
        )}

        {sessions !== null && sessions.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-rule)' }}>
                {['Date', 'Duration', 'Events', 'ERP Events', 'Questions', 'Map', 'Debrief'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '6px 12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: 'var(--color-graphite)',
                      fontSize: '12px',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.session_id}
                  style={{ borderBottom: '1px solid var(--color-rule)' }}
                >
                  <td style={cell}>
                    <Link
                      href={`/sessions/${s.session_id}`}
                      style={{ color: 'var(--color-signal)', textDecoration: 'none' }}
                    >
                      {formatDate(s.start_time)}
                    </Link>
                  </td>
                  <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>
                    {formatDuration(s.start_time, s.end_time)}
                  </td>
                  <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{s.event_count}</td>
                  <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>
                    {s.erp_event_count}
                  </td>
                  <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>
                    {s.question_count}
                  </td>
                  <td style={cell}>
                    {s.has_map ? (
                      <Link
                        href={`/sessions/${s.session_id}/map`}
                        style={{ color: 'var(--color-signal)', textDecoration: 'none' }}
                      >
                        View map
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--color-graphite)' }}>—</span>
                    )}
                  </td>
                  <td style={cell}>
                    {s.debrief_phase ? (
                      <span style={{ color: 'var(--color-graphite)' }}>{s.debrief_phase}</span>
                    ) : (
                      <span style={{ color: 'var(--color-graphite)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}

const cell: React.CSSProperties = {
  padding: '8px 12px',
  color: 'var(--color-ink)',
}
