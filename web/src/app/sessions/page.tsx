'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { fetchSessions, fetchStorage, listTutorSessions } from '@/lib/apiClient'
import type { SessionSummary, StorageInfo, TutorSession } from '@/lib/types'

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
  const secs = Math.round(end ? end - start : Date.now() / 1000 - start)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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
      {/* placeholder icon — simple grid of dots */}
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

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [tutorSessions, setTutorSessions] = useState<TutorSession[] | null>(null)
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
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
    fetchStorage()
      .then(setStorageInfo)
      .catch(() => {})
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
      {/* ── Header ── */}
      <header
        style={{
          background: 'linear-gradient(135deg, #0f1521 0%, #131720 60%, #111827 100%)',
          borderBottom: '1px solid var(--color-border)',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '15px',
            fontWeight: 700,
            background: 'linear-gradient(90deg, #3d7eff 0%, #7c3aed 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          The AI Apprentice
        </span>

        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '13px',
            color: 'var(--color-graphite)',
            textDecoration: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-ink)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-graphite)')
          }
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M9 11L5 7l4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </Link>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: '28px 24px', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
        {error && (
          <div
            className="chip chip-flag"
            style={{ marginBottom: '16px', fontSize: '13px', borderRadius: '6px', padding: '8px 14px' }}
          >
            {error}
          </div>
        )}

        {/* ── Two-column layout ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            alignItems: 'start',
          }}
        >
          {/* ── Expert Sessions card ── */}
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
              <h2
                className="label-upper"
                style={{ margin: 0, letterSpacing: '0.09em' }}
              >
                Expert Sessions
              </h2>
              {sessions !== null && (
                <span
                  className="chip chip-neutral"
                  style={{ fontSize: '11px' }}
                >
                  {sessions.length}
                </span>
              )}
            </div>

            {sessions === null && !error && (
              <EmptyState message="Loading sessions…" />
            )}
            {sessions !== null && sessions.length === 0 && (
              <EmptyState message="No sessions recorded yet." />
            )}

            {sessions !== null && sessions.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: 'rgba(30,37,51,0.5)',
                      }}
                    >
                      {['Date', 'Duration', 'Events', 'ERP', 'Qs', 'Badges', 'Actions'].map((h) => (
                        <th
                          key={h}
                          className="label-upper"
                          style={{
                            padding: '8px 14px',
                            textAlign: 'left',
                            fontWeight: 700,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr
                        key={s.session_id}
                        style={{
                          borderBottom:
                            i < sessions.length - 1
                              ? '1px solid var(--color-border)'
                              : 'none',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLTableRowElement).style.background =
                            'var(--color-surface)')
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLTableRowElement).style.background = 'transparent')
                        }
                      >
                        <td style={cell}>
                          <Link
                            href={`/sessions/${s.session_id}`}
                            style={{
                              color: 'var(--color-signal)',
                              textDecoration: 'none',
                              fontWeight: 500,
                            }}
                          >
                            {formatDate(s.start_time)}
                          </Link>
                        </td>
                        <td
                          style={{
                            ...cell,
                            fontVariantNumeric: 'tabular-nums',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                          }}
                        >
                          {formatDuration(s.start_time, s.end_time)}
                        </td>
                        <td
                          style={{
                            ...cell,
                            fontVariantNumeric: 'tabular-nums',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                          }}
                        >
                          {s.event_count}
                        </td>
                        <td
                          style={{
                            ...cell,
                            fontVariantNumeric: 'tabular-nums',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                          }}
                        >
                          {s.erp_event_count}
                        </td>
                        <td
                          style={{
                            ...cell,
                            fontVariantNumeric: 'tabular-nums',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                          }}
                        >
                          {s.question_count}
                        </td>

                        {/* status chips */}
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            {s.has_map && (
                              <Link
                                href={`/sessions/${s.session_id}/map`}
                                style={{ textDecoration: 'none' }}
                              >
                                <span className="chip chip-signal">Map</span>
                              </Link>
                            )}
                            {s.debrief_phase && (
                              <span className="chip chip-flag">{s.debrief_phase}</span>
                            )}
                            {s.has_map && s.debrief_phase === 'done' && (
                              <span className="chip chip-ok">Confirmed</span>
                            )}
                          </div>
                        </td>

                        {/* actions */}
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                          <Link
                            href={`/sessions/${s.session_id}/privacy`}
                            style={{
                              fontSize: '12px',
                              color: 'var(--color-graphite)',
                              textDecoration: 'none',
                              padding: '3px 8px',
                              border: '1px solid var(--color-border)',
                              borderRadius: '5px',
                              transition: 'border-color 0.12s, color 0.12s',
                            }}
                            onMouseEnter={(e) => {
                              const el = e.currentTarget as HTMLAnchorElement
                              el.style.borderColor = 'var(--color-signal)'
                              el.style.color = 'var(--color-signal)'
                            }}
                            onMouseLeave={(e) => {
                              const el = e.currentTarget as HTMLAnchorElement
                              el.style.borderColor = 'var(--color-border)'
                              el.style.color = 'var(--color-graphite)'
                            }}
                          >
                            Privacy
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Tutor Sessions card ── */}
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
              <h2
                className="label-upper"
                style={{ margin: 0, letterSpacing: '0.09em' }}
              >
                Tutor Sessions
              </h2>
              {tutorSessions !== null && (
                <span className="chip chip-neutral" style={{ fontSize: '11px' }}>
                  {tutorSessions.length}
                </span>
              )}
            </div>

            {tutorSessions === null && (
              <EmptyState message="Loading tutor sessions…" />
            )}
            {tutorSessions !== null && tutorSessions.length === 0 && (
              <EmptyState message="No tutor sessions yet." />
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
                              borderBottom: expanded || !isLast ? '1px solid var(--color-border)' : 'none',
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
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: '12px',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <span className="chip chip-signal">
                                    {ts.mastery.correct_predictions}/{ts.mastery.total_predictions} correct
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
        </div>

        {/* ── Storage visibility ── */}
        {storageInfo && (
          <div
            style={{
              maxWidth: '900px',
              margin: '0 auto',
              padding: '0 20px 32px',
            }}
          >
            <div
              style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: '24px',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-muted)',
                  marginBottom: '12px',
                }}
              >
                Where your data is stored
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
                  marginBottom: '12px',
                }}
              >
                {[
                  { label: 'Sessions', value: String(storageInfo.session_count) },
                  { label: 'Tutor sessions', value: String(storageInfo.tutor_session_count) },
                  { label: 'Total on disk', value: fmtBytes(storageInfo.total_size_bytes) },
                  { label: 'Git-ignored', value: storageInfo.gitignored ? 'Yes' : 'No' },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      background: 'var(--color-panel)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', margin: 0, lineHeight: 1.6 }}>
                Path: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{storageInfo.data_dir}</code>
                <br />
                Screen frames are sent to OpenAI for analysis and are not stored permanently.
                Voice audio is processed by ElevenLabs and is not stored locally.
                All session data on disk is in <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>api/data/</code>{' '}
                which is ignored by git.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const cell: React.CSSProperties = {
  padding: '10px 14px',
  color: 'var(--color-ink)',
  verticalAlign: 'middle',
}
