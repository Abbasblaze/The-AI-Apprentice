'use client'

import { useEffect, useState } from 'react'

import { listTutorSessions } from '@/lib/apiClient'
import { ModeHeader } from '@/components/ModeHeader'
import type { TutorSession } from '@/lib/types'

function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        gap: '12px',
        color: 'var(--color-graphite)',
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        style={{ opacity: 0.35 }}
      >
        <rect x="4" y="4" width="14" height="14" rx="3" fill="currentColor" />
        <rect x="22" y="4" width="14" height="14" rx="3" fill="currentColor" />
        <rect x="4" y="22" width="14" height="14" rx="3" fill="currentColor" />
        <rect x="22" y="22" width="14" height="14" rx="3" fill="currentColor" opacity="0.4" />
      </svg>
      <p className="text-sm" style={{ color: 'var(--color-graphite)', margin: 0 }}>
        {message}
      </p>
    </div>
  )
}

function MasteryBar({ mastered, total }: { mastered: number; total: number }) {
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px' }}>
      <div
        style={{
          flex: 1,
          height: '6px',
          borderRadius: '3px',
          background: 'var(--color-surface)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: '3px',
            background:
              pct >= 80
                ? 'var(--color-ok)'
                : pct >= 40
                  ? 'var(--color-signal)'
                  : 'var(--color-flag)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span
        style={{
          fontSize: '11px',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-graphite)',
          whiteSpace: 'nowrap',
        }}
      >
        {mastered}/{total}
      </span>
    </div>
  )
}

const cell: React.CSSProperties = {
  padding: '10px 14px',
  color: 'var(--color-ink)',
  verticalAlign: 'middle',
}

export default function LearnSessionsPage() {
  const [tutorSessions, setTutorSessions] = useState<TutorSession[] | null>(null)
  const [expandedTutorId, setExpandedTutorId] = useState<string | null>(null)

  useEffect(() => {
    listTutorSessions()
      .then(setTutorSessions)
      .catch(() => setTutorSessions([]))
  }, [])

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-paper)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ModeHeader mode="learner" />

      <main
        style={{
          flex: 1,
          padding: '28px 24px',
          maxWidth: '1100px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <section className="glass-card" style={{ overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2 className="label-upper" style={{ margin: 0, letterSpacing: '0.09em' }}>
              My Sessions
            </h2>
            {tutorSessions !== null && (
              <span className="chip chip-neutral" style={{ fontSize: '11px' }}>
                {tutorSessions.length}
              </span>
            )}
          </div>

          {tutorSessions === null && <EmptyState message="Loading sessions…" />}
          {tutorSessions !== null && tutorSessions.length === 0 && (
            <EmptyState message="No sessions yet." />
          )}

          {tutorSessions !== null && tutorSessions.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      background: 'rgba(30,37,51,0.5)',
                    }}
                  >
                    {['Date', 'Map Session', 'Interventions', 'Mastery'].map((h) => (
                      <th
                        key={h}
                        className="label-upper"
                        style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tutorSessions.map((ts, i) => {
                    const isLast = i === tutorSessions.length - 1
                    const expanded = expandedTutorId === ts.id
                    return (
                      <>
                        <tr
                          key={ts.id}
                          onClick={() =>
                            setExpandedTutorId((prev) => (prev === ts.id ? null : ts.id))
                          }
                          style={{
                            borderBottom:
                              expanded || !isLast ? '1px solid var(--color-border)' : 'none',
                            cursor: 'pointer',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLTableRowElement).style.background =
                              'var(--color-surface)')
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLTableRowElement).style.background =
                              'transparent')
                          }
                        >
                          <td style={cell}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 10 10"
                                fill="none"
                                aria-hidden="true"
                                style={{
                                  flexShrink: 0,
                                  color: 'var(--color-graphite)',
                                  transition: 'transform 0.18s',
                                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                }}
                              >
                                <path
                                  d="M3.5 2l4 3-4 3"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              {formatDate(ts.started_at)}
                            </div>
                          </td>
                          <td
                            style={{
                              ...cell,
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--color-graphite)',
                            }}
                          >
                            {ts.work_map_session_id.slice(0, 12)}…
                          </td>
                          <td
                            style={{
                              ...cell,
                              fontVariantNumeric: 'tabular-nums',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              textAlign: 'center',
                            }}
                          >
                            {ts.interventions.length}
                          </td>
                          <td style={cell}>
                            {ts.mastery ? (
                              <MasteryBar
                                mastered={ts.mastery.mastered_steps.length}
                                total={ts.mastery.step_mastery.length}
                              />
                            ) : (
                              <span
                                className={`chip ${ts.ended_at ? 'chip-neutral' : 'chip-flag'}`}
                              >
                                {ts.ended_at ? 'No summary' : 'In progress'}
                              </span>
                            )}
                          </td>
                        </tr>

                        {expanded && ts.mastery && (
                          <tr
                            key={`${ts.id}-detail`}
                            style={{
                              borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                            }}
                          >
                            <td
                              colSpan={4}
                              style={{
                                padding: '14px 20px',
                                background: 'rgba(26,32,48,0.7)',
                              }}
                            >
                              <p
                                style={{
                                  margin: '0 0 8px',
                                  fontSize: '13px',
                                  color: 'var(--color-ink)',
                                  lineHeight: '1.5',
                                }}
                              >
                                {ts.mastery.summary_text}
                              </p>
                              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <span className="chip chip-signal">
                                  {ts.mastery.correct_predictions}/{ts.mastery.total_predictions}{' '}
                                  correct
                                </span>
                                <span className="chip chip-neutral">
                                  {ts.mastery.corrected_interventions} corrected after block
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
