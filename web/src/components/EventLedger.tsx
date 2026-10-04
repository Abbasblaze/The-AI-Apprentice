'use client'

import { useEffect, useRef } from 'react'

import type { EventKind, LedgerEntry, QuestionKind } from '@/lib/types'

interface Props {
  entries: LedgerEntry[]
}

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0')
  const ss = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

const KIND_COLORS: Record<EventKind, string> = {
  opened: 'var(--color-graphite)',
  changed: 'var(--color-ink)',
  typed: 'var(--color-ink)',
  selected: 'var(--color-graphite)',
  navigated: 'var(--color-graphite)',
  error: 'var(--color-flag)',
  other: 'var(--color-graphite)',
}

const KIND_BG: Record<EventKind, string> = {
  opened: 'color-mix(in srgb, var(--color-graphite) 12%, transparent)',
  changed: 'color-mix(in srgb, var(--color-ink) 10%, transparent)',
  typed: 'color-mix(in srgb, var(--color-ink) 10%, transparent)',
  selected: 'color-mix(in srgb, var(--color-graphite) 12%, transparent)',
  navigated: 'color-mix(in srgb, var(--color-graphite) 12%, transparent)',
  error: 'color-mix(in srgb, var(--color-flag) 15%, transparent)',
  other: 'color-mix(in srgb, var(--color-graphite) 12%, transparent)',
}

const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  reason: 'reason',
  limit: 'limit',
  exception: 'exception',
  escalation: 'escalation',
  guardrail: 'guardrail',
}

function Chip({
  label,
  color,
  bg,
}: {
  label: string
  color: string
  bg: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '1px 6px',
        borderRadius: '4px',
        color,
        background: bg,
        lineHeight: '16px',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

function EventRow({ entry }: { entry: Extract<LedgerEntry, { type: 'event' }> }) {
  const { data: event } = entry
  const isErp = event.source === 'erp'
  return (
    <div className="event-entry flex">
      <div
        style={{
          width: '52px',
          flexShrink: 0,
          paddingTop: '12px',
          paddingRight: '10px',
          textAlign: 'right',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '11px',
          color: '#4a5a78',
          tabularNums: true,
        } as React.CSSProperties}
      >
        {formatTime(event.t)}
      </div>
      <div
        style={{
          flex: 1,
          paddingTop: '10px',
          paddingBottom: '10px',
          paddingLeft: '14px',
          paddingRight: '16px',
          borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
          <Chip
            label={event.kind}
            color={KIND_COLORS[event.kind]}
            bg={KIND_BG[event.kind]}
          />
          {isErp && (
            <Chip
              label="ERP"
              color="#5b8dee"
              bg="color-mix(in srgb, #5b8dee 14%, transparent)"
            />
          )}
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#e8eaf0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '38ch',
            }}
          >
            {event.subject}
          </span>
          {event.field && (
            <span style={{ fontSize: '11px', color: '#4a5a78' }}>{event.field}</span>
          )}
        </div>
        <p
          style={{
            fontSize: '12px',
            color: '#4a5a78',
            maxWidth: '52ch',
            margin: 0,
            lineHeight: '1.5',
          }}
        >
          {event.summary}
        </p>
        {(event.from_value || event.to_value) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              color: '#4a5a78',
            }}
          >
            {event.from_value && <span>{event.from_value}</span>}
            {event.from_value && event.to_value && (
              <span style={{ color: '#2a3547' }}>→</span>
            )}
            {event.to_value && (
              <span style={{ color: '#c8ccd8' }}>{event.to_value}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function QuestionRow({ entry }: { entry: Extract<LedgerEntry, { type: 'question' }> }) {
  const { data: question } = entry
  const isGuardrail = question.kind === 'guardrail'
  const borderColor = isGuardrail ? 'var(--color-flag, #f59e0b)' : '#3b7fe8'
  return (
    <div className="event-entry flex">
      <div
        style={{
          width: '52px',
          flexShrink: 0,
          paddingTop: '13px',
          paddingRight: '10px',
          textAlign: 'right',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '11px',
          color: '#4a5a78',
        }}
      >
        {formatTime(question.t)}
      </div>
      <div
        style={{
          flex: 1,
          paddingTop: '10px',
          paddingBottom: '10px',
          paddingLeft: '14px',
          paddingRight: '16px',
          borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)',
          borderLeft: `3px solid ${borderColor}`,
          background: isGuardrail
            ? 'color-mix(in srgb, var(--color-flag, #f59e0b) 6%, transparent)'
            : 'color-mix(in srgb, #3b7fe8 6%, transparent)',
          borderRadius: '0 6px 6px 0',
          marginRight: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
          <Chip
            label={QUESTION_KIND_LABELS[question.kind]}
            color={isGuardrail ? 'var(--color-flag, #f59e0b)' : '#5b8dee'}
            bg={
              isGuardrail
                ? 'color-mix(in srgb, var(--color-flag, #f59e0b) 15%, transparent)'
                : 'color-mix(in srgb, #5b8dee 15%, transparent)'
            }
          />
        </div>
        <p
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#e8eaf0',
            maxWidth: '52ch',
            margin: 0,
            lineHeight: '1.5',
          }}
        >
          {question.text}
        </p>
      </div>
    </div>
  )
}

function AnswerRow({ entry }: { entry: Extract<LedgerEntry, { type: 'answer' }> }) {
  return (
    <div className="event-entry flex">
      <div
        style={{
          width: '52px',
          flexShrink: 0,
          paddingTop: '12px',
          paddingRight: '10px',
          textAlign: 'right',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '11px',
          color: '#4a5a78',
        }}
      >
        {formatTime(entry.t)}
      </div>
      <div
        style={{
          flex: 1,
          paddingTop: '10px',
          paddingBottom: '10px',
          paddingLeft: '13px',
          paddingRight: '16px',
          borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)',
          borderLeft: '1px dashed #2a3547',
        }}
      >
        <p
          style={{
            fontSize: '13px',
            fontStyle: 'italic',
            color: '#4a5a78',
            maxWidth: '52ch',
            margin: 0,
            lineHeight: '1.5',
          }}
        >
          {entry.text}
        </p>
      </div>
    </div>
  )
}

function OffRecordGapRow({
  entry,
}: {
  entry: Extract<LedgerEntry, { type: 'off-record-gap' }>
}) {
  const range =
    entry.end_t === null
      ? `${formatTime(entry.start_t)}–… (ongoing)`
      : `${formatTime(entry.start_t)}–${formatTime(entry.end_t)}`
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '6px 16px',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '0.02em',
          padding: '3px 10px',
          borderRadius: '20px',
          color: '#c89a2a',
          background: 'color-mix(in srgb, #c89a2a 12%, transparent)',
          border: '1px solid color-mix(in srgb, #c89a2a 25%, transparent)',
        }}
      >
        Off the record · {range}
      </span>
    </div>
  )
}

function TranscriptRow({
  entry,
}: {
  entry: Extract<LedgerEntry, { type: 'transcript' }>
}) {
  const isUser = entry.role === 'user'
  return (
    <div className="event-entry flex">
      <div
        style={{
          width: '52px',
          flexShrink: 0,
          paddingTop: '10px',
          paddingRight: '10px',
          textAlign: 'right',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '11px',
          color: '#4a5a78',
        }}
      >
        {formatTime(entry.t)}
      </div>
      <div
        style={{
          flex: 1,
          paddingTop: '8px',
          paddingBottom: '8px',
          paddingLeft: '13px',
          paddingRight: '16px',
          borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)',
          borderLeft: isUser ? '2px solid var(--color-signal)' : '1px solid var(--color-border)',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: isUser ? 'var(--color-signal)' : '#4a5a78',
            marginRight: '6px',
          }}
        >
          {isUser ? 'you' : 'agent'}
        </span>
        <span style={{ fontSize: '13px', color: '#c8d0de' }}>{entry.text}</span>
      </div>
    </div>
  )
}

function ForgetThatRow({
  entry,
}: {
  entry: Extract<LedgerEntry, { type: 'forget-that' }>
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '6px 16px',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '0.02em',
          padding: '3px 10px',
          borderRadius: '6px',
          color: 'color-mix(in srgb, var(--color-flag, #e57373) 70%, #aaa)',
          background: 'color-mix(in srgb, var(--color-flag, #e57373) 8%, transparent)',
        }}
      >
        Content removed · {entry.events_removed} events
      </span>
    </div>
  )
}

export function EventLedger({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--color-panel)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#4a5a78',
          }}
        >
          Events
        </span>
        {entries.length > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '18px',
              height: '16px',
              padding: '0 5px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: 600,
              color: '#4a5a78',
              background: 'color-mix(in srgb, #4a5a78 14%, transparent)',
            }}
          >
            {entries.length}
          </span>
        )}
      </div>

      {/* Timeline body */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {/* Timeline spine */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '52px',
            width: '1px',
            backgroundColor: '#1e2533',
            pointerEvents: 'none',
          }}
        />

        {entries.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              paddingTop: '24px',
              paddingLeft: '68px',
              paddingRight: '16px',
              color: '#4a5a78',
            }}
          >
            <p style={{ fontSize: '13px', margin: 0 }}>No events yet.</p>
          </div>
        ) : (
          <div style={{ paddingBottom: '16px' }}>
            {entries.map((entry) => {
              if (entry.type === 'event') return <EventRow key={entry.data.id} entry={entry} />
              if (entry.type === 'question')
                return <QuestionRow key={entry.data.id} entry={entry} />
              if (entry.type === 'transcript')
                return <TranscriptRow key={entry.id} entry={entry} />
              if (entry.type === 'off-record-gap')
                return <OffRecordGapRow key={entry.id} entry={entry} />
              if (entry.type === 'forget-that')
                return <ForgetThatRow key={entry.id} entry={entry} />
              return <AnswerRow key={entry.id} entry={entry} />
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
