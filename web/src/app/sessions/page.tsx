'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { fetchSessions, listTutorSessions } from '@/lib/apiClient'
import type { SessionSummary, TutorSession } from '@/lib/types'

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
  const [tutorSessions, setTutorSessions] = useState<TutorSession[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedTutorId, setExpandedTutorId] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load sessions'),
      )
    listTutorSessions()
      .then(setTutorSessions)
      .catch(() => setTutorSessions([]))
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
                {['Date', 'Duration', 'Events', 'ERP Events', 'Questions', 'Map', 'Debrief', 'Privacy'].map((h) => (
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
                  <td style={cell}>
                    <Link
                      href={`/sessions/${s.session_id}/privacy`}
                      style={{ color: 'var(--color-signal)', textDecoration: 'none' }}
                    >
                      Privacy
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2
          className="text-sm font-medium mb-4 mt-8"
          style={{ color: 'var(--color-graphite)', fontFamily: 'var(--font-heading)' }}
        >
          Tutor Sessions
        </h2>

        {tutorSessions !== null && tutorSessions.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--color-graphite)' }}>
            No tutor sessions yet.
          </p>
        )}

        {tutorSessions !== null && tutorSessions.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-rule)' }}>
                {['Date', 'Map Session', 'Interventions', 'Mastery'].map((h) => (
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
              {tutorSessions.map((ts) => (
                <>
                  <tr
                    key={ts.id}
                    style={{ borderBottom: '1px solid var(--color-rule)', cursor: 'pointer' }}
                    onClick={() =>
                      setExpandedTutorId((prev) => (prev === ts.id ? null : ts.id))
                    }
                  >
                    <td style={cell}>{formatDate(ts.started_at)}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '12px' }}>
                      {ts.work_map_session_id.slice(0, 12)}…
                    </td>
                    <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>
                      {ts.interventions.length}
                    </td>
                    <td style={cell}>
                      {ts.mastery ? (
                        <span>
                          {ts.mastery.mastered_steps.length} / {ts.mastery.step_mastery.length} mastered
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-graphite)' }}>
                          {ts.ended_at ? 'No summary' : 'In progress'}
                        </span>
                      )}
                    </td>
                  </tr>
                  {expandedTutorId === ts.id && ts.mastery && (
                    <tr key={`${ts.id}-detail`} style={{ borderBottom: '1px solid var(--color-rule)' }}>
                      <td colSpan={4} style={{ padding: '12px 20px', background: 'var(--color-panel)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--color-ink)', marginBottom: '8px' }}>
                          {ts.mastery.summary_text}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-graphite)', fontVariantNumeric: 'tabular-nums' }}>
                          {ts.mastery.correct_predictions} of {ts.mastery.total_predictions} predictions correct
                          {' · '}
                          {ts.mastery.corrected_interventions} corrected after block
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
