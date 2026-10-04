'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { fetchSession, fetchSessions, snapshotUrl } from '@/lib/apiClient'
import type { AppEvent, QuestionEntry, SessionRecord, SessionSummary } from '@/lib/types'

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

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [record, setRecord] = useState<SessionRecord | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedT, setSelectedT] = useState<number | null>(null)

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {record?.end_time && summary?.has_map && (
            <Link
              href={`/sessions/${id}/map`}
              className="text-sm"
              style={{ color: 'var(--color-signal)', textDecoration: 'none' }}
            >
              View map
            </Link>
          )}
          {record?.end_time && (
            <Link
              href={`/sessions/${id}/debrief`}
              className="text-sm"
              style={{
                padding: '4px 12px',
                background: 'var(--color-signal)',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              Start debrief
            </Link>
          )}
          <Link
            href="/sessions"
            className="text-sm"
            style={{ color: 'var(--color-signal)', textDecoration: 'none' }}
          >
            ← Sessions
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <aside
          className="flex-1 overflow-auto"
          style={{ borderRight: '1px solid var(--color-rule)', minWidth: 0 }}
        >
          {error && (
            <p className="p-4 text-sm" style={{ color: 'var(--color-flag)' }}>
              {error}
            </p>
          )}
          {!record && !error && (
            <p className="p-4 text-sm" style={{ color: 'var(--color-graphite)' }}>
              Loading…
            </p>
          )}
          {timeline.map((item, i) => (
            <TimelineRow key={i} item={item} onSelect={(t) => setSelectedT(t)} />
          ))}
        </aside>

        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: '420px',
            background: 'var(--color-panel)',
            borderLeft: '1px solid var(--color-rule)',
          }}
        >
          {snapSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={snapSrc}
              alt="Screen snapshot"
              style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
            />
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-graphite)' }}>
              {selectedT !== null ? 'No snapshot for this item.' : 'Click an item to view its snapshot.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function TimelineRow({
  item,
  onSelect,
}: {
  item: TimelineItem
  onSelect: (t: number) => void
}) {
  if (item.kind === 'event') {
    const isErp = item.data.source === 'erp'
    return (
      <button
        onClick={() => onSelect(item.t)}
        style={{
          display: 'flex',
          width: '100%',
          gap: '12px',
          padding: '7px 14px',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid var(--color-rule)',
          textAlign: 'left',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--color-panel)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = ''
        }}
      >
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontSize: '11px',
            color: 'var(--color-graphite)',
            flexShrink: 0,
            paddingTop: '2px',
            width: '40px',
          }}
        >
          {fmtT(item.t)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', color: 'var(--color-graphite)', marginBottom: '1px' }}>
            {isErp ? '⚡ ' : ''}{item.data.kind} · {item.data.subject}
            {item.data.field ? ` · ${item.data.field}` : ''}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-ink)' }}>{item.data.summary}</div>
        </div>
      </button>
    )
  }

  if (item.kind === 'question') {
    const isGuardrail = item.data.kind === 'guardrail'
    return (
      <button
        onClick={() => onSelect(item.t)}
        style={{
          display: 'flex',
          width: '100%',
          gap: '12px',
          padding: '7px 14px',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid var(--color-rule)',
          borderLeft: isGuardrail ? '2px solid var(--color-flag)' : '2px solid transparent',
          textAlign: 'left',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--color-panel)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = ''
        }}
      >
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontSize: '11px',
            color: 'var(--color-graphite)',
            flexShrink: 0,
            paddingTop: '2px',
            width: '40px',
          }}
        >
          {fmtT(item.t)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: isGuardrail ? 'var(--color-flag)' : 'var(--color-signal)',
              marginBottom: '1px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {item.data.kind} question
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-ink)' }}>{item.data.text}</div>
        </div>
      </button>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '7px 14px',
        borderBottom: '1px solid var(--color-rule)',
        background: 'var(--color-panel)',
      }}
    >
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: '11px',
          color: 'var(--color-graphite)',
          flexShrink: 0,
          paddingTop: '2px',
          width: '40px',
        }}
      >
        {fmtT(item.t)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-graphite)',
            marginBottom: '1px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Answer
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-ink)' }}>{item.text}</div>
      </div>
    </div>
  )
}
