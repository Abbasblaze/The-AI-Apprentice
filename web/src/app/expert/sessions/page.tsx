'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { fetchSessions, fetchStorage } from '@/lib/apiClient'
import { ModeHeader } from '@/components/ModeHeader'
import type { SessionSummary, StorageInfo } from '@/lib/types'

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

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

const cell: React.CSSProperties = {
  padding: '10px 14px',
  color: 'var(--color-ink)',
  verticalAlign: 'middle',
}

export default function ExpertSessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load sessions'),
      )
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
      <ModeHeader mode="expert" />

      <main
        style={{ flex: 1, padding: '28px 24px', maxWidth: '1100px', width: '100%', margin: '0 auto' }}
      >
        {error && (
          <div
            className="chip chip-flag"
            style={{ marginBottom: '16px', fontSize: '13px', borderRadius: '6px', padding: '8px 14px' }}
          >
            {error}
          </div>
        )}

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
              Expert Sessions
            </h2>
            {sessions !== null && (
              <span className="chip chip-neutral" style={{ fontSize: '11px' }}>
                {sessions.length}
              </span>
            )}
          </div>

          {sessions === null && !error && <EmptyState message="Loading sessions…" />}
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
                        style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700 }}
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
                          i < sessions.length - 1 ? '1px solid var(--color-border)' : 'none',
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
                          href={`/expert/sessions/${s.session_id}`}
                          style={{ color: 'var(--color-signal)', textDecoration: 'none', fontWeight: 500 }}
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
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {s.has_map && (
                            <Link
                              href={`/expert/sessions/${s.session_id}/map`}
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
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        <Link
                          href={`/expert/sessions/${s.session_id}/privacy`}
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

        {storageInfo && (
          <div style={{ marginTop: '32px' }}>
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '24px' }}>
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
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'var(--color-ink-muted)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontWeight: 600,
                      }}
                    >
                      {m.label}
                    </div>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-ink)',
                      }}
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--color-ink-muted)',
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Path:{' '}
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  {storageInfo.data_dir}
                </code>
                <br />
                Screen frames are sent to OpenAI for analysis and are not stored permanently. Voice
                audio is processed by ElevenLabs and is not stored locally. All session data on disk
                is in{' '}
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>api/data/</code>{' '}
                which is ignored by git.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
