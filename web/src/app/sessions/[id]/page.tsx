'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { fetchSession, fetchSessions, snapshotUrl } from '@/lib/apiClient'
import type { AppEvent, QuestionEntry, SessionRecord, SessionSummary } from '@/lib/types'

// ---------------------------------------------------------------------------
// Timeline helpers
// ---------------------------------------------------------------------------

type TimelineItem =
  | { kind: 'event'; t: number; data: AppEvent }
  | { kind: 'question'; t: number; data: QuestionEntry }
  | { kind: 'answer'; t: number; questionId: string; text: string }

function buildTimeline(record: SessionRecord): TimelineItem[] {
  const items: TimelineItem[] = []

  for (const e of record.events) {
    items.push({ kind: 'event', t: e.t, data: e })
  }
  for (const e of record.erp_events) {
    items.push({ kind: 'event', t: e.t, data: e })
  }
  for (const d of record.decisions) {
    if (!d.should_ask) continue
    const q: QuestionEntry = {
      id: d.id,
      t: d.t,
      kind: d.kind,
      text: d.question,
      anchorEventId: d.anchor_event_id,
      answered: d.answered,
      answerText: d.answer_text,
    }
    items.push({ kind: 'question', t: d.t, data: q })
    if (d.answered && d.answer_text) {
      items.push({ kind: 'answer', t: d.t + 0.001, questionId: d.id, text: d.answer_text })
    }
  }

  return items.sort((a, b) => a.t - b.t)
}

function fmtT(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function fmtDuration(start: number, end: number | null): string {
  const secs = Math.round(end ? end - start : Date.now() / 1000 - start)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function nearestSnapshot(record: SessionRecord, targetT: number): number | null {
  if (record.snapshots.length === 0) return null
  let best = record.snapshots[0]
  let bestDiff = Math.abs(best.t - targetT)
  for (const snap of record.snapshots) {
    const diff = Math.abs(snap.t - targetT)
    if (diff < bestDiff) {
      best = snap
      bestDiff = diff
    }
  }
  return best.t
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      className="glass-card"
      style={{ padding: '12px 16px', minWidth: 0 }}
    >
      <div className="label-upper" style={{ marginBottom: '6px' }}>
        {label}
      </div>
      <div
        className="stat-number"
        style={accent ? { color: 'var(--color-signal)' } : undefined}
      >
        {value}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Glass card wrapper
// ---------------------------------------------------------------------------

function GlassCard({
  title,
  badge,
  children,
  maxHeight,
  action,
}: {
  title: string
  badge?: string | number
  children: React.ReactNode
  maxHeight?: string
  action?: React.ReactNode
}) {
  return (
    <div
      className="glass-card"
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-muted)',
            }}
          >
            {title}
          </span>
          {badge !== undefined && (
            <span className="chip chip-neutral">{badge}</span>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div
        style={{
          overflowY: 'auto',
          maxHeight: maxHeight ?? 'none',
          flex: maxHeight ? undefined : 1,
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timeline row
// ---------------------------------------------------------------------------

function TimelineRow({
  item,
  isSelected,
  onSelect,
}: {
  item: TimelineItem
  isSelected: boolean
  onSelect: (t: number) => void
}) {
  const baseRow: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    gap: '10px',
    padding: '8px 14px',
    background: isSelected ? 'var(--color-surface)' : 'none',
    border: 'none',
    borderBottom: '1px solid var(--color-border)',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.1s',
  }

  const timestamp = (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: '10px',
        color: 'var(--color-ink-muted)',
        flexShrink: 0,
        paddingTop: '2px',
        width: '38px',
      }}
    >
      {fmtT(item.t)}
    </span>
  )

  if (item.kind === 'event') {
    const isErp = item.data.source === 'erp'
    return (
      <button
        onClick={() => onSelect(item.t)}
        style={{
          ...baseRow,
          borderLeft: isErp
            ? '2px solid var(--color-accent)'
            : '2px solid transparent',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'none'
        }}
      >
        {timestamp}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '2px',
              flexWrap: 'wrap',
            }}
          >
            {isErp && <span className="chip chip-neutral" style={{ fontSize: '9px' }}>ERP</span>}
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--color-ink-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {item.data.kind}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--color-border)' }}>·</span>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
              {item.data.subject}
              {item.data.field ? ` · ${item.data.field}` : ''}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-ink)', lineHeight: 1.4 }}>
            {item.data.summary}
          </div>
        </div>
      </button>
    )
  }

  if (item.kind === 'question') {
    const isGuardrail = item.data.kind === 'guardrail'
    const chipClass = isGuardrail ? 'chip chip-flag' : 'chip chip-signal'
    return (
      <button
        onClick={() => onSelect(item.t)}
        style={{
          ...baseRow,
          borderLeft: isGuardrail
            ? '2px solid var(--color-flag)'
            : '2px solid var(--color-signal)',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'none'
        }}
      >
        {timestamp}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <span className={chipClass}>{item.data.kind}</span>
            {item.data.answered && (
              <span className="chip chip-ok">answered</span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-ink)', lineHeight: 1.4 }}>
            {item.data.text}
          </div>
        </div>
      </button>
    )
  }

  // answer
  return (
    <div
      style={{
        ...baseRow,
        borderLeft: '2px solid var(--color-ok)',
        background: 'rgba(34,197,94,0.03)',
        cursor: 'default',
      }}
    >
      {timestamp}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ marginBottom: '3px' }}>
          <span className="chip chip-ok">reply</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-ink)', lineHeight: 1.4 }}>
          {item.text}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Transcript panel content
// ---------------------------------------------------------------------------

function TranscriptList({ entries }: { entries: SessionRecord['transcript'] }) {
  if (entries.length === 0) {
    return (
      <p style={{ padding: '20px 16px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
        No transcript recorded.
      </p>
    )
  }
  return (
    <div style={{ padding: '4px 0' }}>
      {entries.map((e, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: '10px',
            padding: '7px 16px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-ink-muted)',
              flexShrink: 0,
              paddingTop: '2px',
              width: '38px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtT(e.t)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                marginRight: '6px',
                color: e.role === 'agent' ? 'var(--color-signal)' : 'var(--color-ink)',
              }}
            >
              {e.role === 'agent' ? 'AI' : 'Expert'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-ink)', lineHeight: 1.5 }}>
              {e.message}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Decisions panel content
// ---------------------------------------------------------------------------

function DecisionsList({ decisions }: { decisions: SessionRecord['decisions'] }) {
  const asked = decisions.filter((d) => d.should_ask)
  if (asked.length === 0) {
    return (
      <p style={{ padding: '20px 16px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
        No decisions to review.
      </p>
    )
  }
  return (
    <div style={{ padding: '4px 0' }}>
      {asked.map((d) => (
        <div
          key={d.id}
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--color-border)',
            borderLeft: d.kind === 'guardrail' ? '2px solid var(--color-flag)' : '2px solid transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              className={d.kind === 'guardrail' ? 'chip chip-flag' : 'chip chip-signal'}
            >
              {d.kind}
            </span>
            {d.answered ? (
              <span className="chip chip-ok">answered</span>
            ) : (
              <span className="chip chip-neutral">pending</span>
            )}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--color-ink-muted)',
                marginLeft: 'auto',
              }}
            >
              {fmtT(d.t)}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-ink)', lineHeight: 1.5, marginBottom: d.answer_text ? '6px' : 0 }}>
            {d.question}
          </div>
          {d.answer_text && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--color-ink-muted)',
                borderLeft: '2px solid var(--color-ok)',
                paddingLeft: '8px',
                marginTop: '4px',
                lineHeight: 1.5,
              }}
            >
              {d.answer_text}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [record, setRecord] = useState<SessionRecord | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedT, setSelectedT] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'timeline' | 'transcript' | 'decisions'>('timeline')

  useEffect(() => {
    if (!id) return
    fetchSession(id)
      .then(setRecord)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load session'),
      )
    fetchSessions()
      .then((sessions) => {
        const s = sessions.find((s) => s.session_id === id)
        if (s) setSummary(s)
      })
      .catch(() => {})
  }, [id])

  const timeline = record ? buildTimeline(record) : []
  const snapT = selectedT !== null && record ? nearestSnapshot(record, selectedT) : null
  const snapSrc = snapT !== null && id ? snapshotUrl(id, snapT) : null

  const eventCount = record?.events.length ?? 0
  const erpCount = record?.erp_events.length ?? 0
  const questionCount = record?.decisions.filter((d) => d.should_ask).length ?? 0
  const answeredCount = record?.decisions.filter((d) => d.should_ask && d.answered).length ?? 0
  const transcriptCount = record?.transcript.length ?? 0
  const duration =
    record?.start_time !== undefined
      ? fmtDuration(record.start_time, record.end_time ?? null)
      : '—'

  const shortId = id ? `${id.slice(0, 8)}…${id.slice(-4)}` : '—'

  const isLive = record !== null && record.end_time === null

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', backgroundColor: 'var(--color-paper)' }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header
        style={{ borderBottom: '1px solid var(--color-border)' }}
        className="flex items-center justify-between px-5 py-3 shrink-0"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1
            className="text-base font-medium tracking-tight"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
              The AI Apprentice
            </Link>
          </h1>
          <span style={{ color: 'var(--color-border)' }}>/</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--color-ink-muted)',
              letterSpacing: '0.02em',
            }}
          >
            {shortId}
          </span>
          {isLive && (
            <span className="chip chip-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span
                className="live-dot"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--color-ok)',
                  display: 'inline-block',
                }}
              />
              Live
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/sessions" className="btn-ghost" style={{ textDecoration: 'none' }}>
            ← Sessions
          </Link>
          {record?.end_time && summary?.has_map && (
            <Link href={`/sessions/${id}/map`} className="btn-ghost" style={{ textDecoration: 'none' }}>
              Work Map
            </Link>
          )}
          {record?.end_time && (
            <Link href={`/sessions/${id}/debrief`} className="btn-primary" style={{ textDecoration: 'none' }}>
              Start Debrief
            </Link>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Error / loading                                                      */}
      {/* ------------------------------------------------------------------ */}
      {error && (
        <div
          style={{
            padding: '10px 20px',
            background: 'var(--color-flag-dim)',
            borderBottom: '1px solid var(--color-flag)',
            fontSize: '13px',
            color: 'var(--color-flag)',
          }}
        >
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Stats bar                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <MetricCard label="Duration" value={duration} />
        <MetricCard label="Events" value={eventCount} />
        <MetricCard label="ERP Events" value={erpCount} />
        <MetricCard label="Questions" value={questionCount} />
        <MetricCard label="Answered" value={answeredCount} accent />
        <MetricCard label="Transcript" value={transcriptCount} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Body: left panel (tabs) + right snapshot                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 overflow-hidden min-h-0" style={{ gap: 0 }}>
        {/* Left: tabbed panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
            borderRight: '1px solid var(--color-border)',
          }}
        >
          {/* Tab bar */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-panel)',
              flexShrink: 0,
            }}
          >
            {(
              [
                { key: 'timeline', label: 'Timeline', count: timeline.length },
                { key: 'transcript', label: 'Transcript', count: transcriptCount },
                { key: 'decisions', label: 'Decisions', count: questionCount },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '9px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom:
                    activeTab === tab.key
                      ? '2px solid var(--color-signal)'
                      : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: activeTab === tab.key ? 700 : 500,
                  color:
                    activeTab === tab.key ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'color 0.1s',
                }}
              >
                {tab.label}
                {record && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '10px',
                      background:
                        activeTab === tab.key
                          ? 'var(--color-signal-dim)'
                          : 'rgba(136,152,179,0.1)',
                      color:
                        activeTab === tab.key
                          ? 'var(--color-signal)'
                          : 'var(--color-ink-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {!record && !error && (
              <div style={{ padding: '24px 20px', fontSize: '13px', color: 'var(--color-ink-muted)' }}>
                Loading session…
              </div>
            )}

            {record && activeTab === 'timeline' && (
              <>
                {timeline.length === 0 && (
                  <p style={{ padding: '20px 16px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                    No timeline events yet.
                  </p>
                )}
                {timeline.map((item, i) => (
                  <TimelineRow
                    key={i}
                    item={item}
                    isSelected={item.t === selectedT}
                    onSelect={(t) => setSelectedT(t)}
                  />
                ))}
              </>
            )}

            {record && activeTab === 'transcript' && (
              <TranscriptList entries={record.transcript} />
            )}

            {record && activeTab === 'decisions' && (
              <DecisionsList decisions={record.decisions} />
            )}
          </div>
        </div>

        {/* Right: snapshot viewer */}
        <div
          style={{
            width: '380px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--color-panel)',
          }}
        >
          {/* Snapshot card header */}
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-muted)',
              }}
            >
              Snapshot
            </span>
            {snapT !== null && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--color-signal)',
                }}
              >
                {fmtT(snapT)}
              </span>
            )}
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              overflow: 'hidden',
            }}
          >
            {snapSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={snapSrc}
                alt="Screen snapshot"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  display: 'block',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    fontSize: '20px',
                  }}
                >
                  &#9654;
                </div>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-ink-muted)',
                    lineHeight: 1.5,
                    maxWidth: '200px',
                  }}
                >
                  {selectedT !== null
                    ? 'No snapshot available for this item.'
                    : 'Click any timeline item to view its screen snapshot.'}
                </p>
              </div>
            )}
          </div>

          {/* Snapshot count footer */}
          {record && (
            <div
              style={{
                padding: '8px 16px',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span className="label-upper">Snapshots</span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--color-ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {record.snapshots.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
