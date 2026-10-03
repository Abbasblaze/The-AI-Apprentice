'use client'

import { useEffect, useRef } from 'react'

import type { AppEvent, EventKind } from '@/lib/types'

interface Props {
  events: AppEvent[]
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

export function EventLedger({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="px-4 py-3 text-xs font-medium shrink-0"
        style={{
          color: 'var(--color-graphite)',
          borderBottom: '1px solid var(--color-rule)',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.01em',
        }}
      >
        Events
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: '52px',
            width: '1px',
            backgroundColor: 'var(--color-rule)',
          }}
        />

        {events.length === 0 ? (
          <div
            className="flex items-start pt-6 pl-16 pr-4"
            style={{ color: 'var(--color-graphite)' }}
          >
            <p className="text-sm">No events yet.</p>
          </div>
        ) : (
          <div className="pb-4">
            {events.map((event) => (
              <div key={event.id} className="event-entry flex">
                <div
                  className="shrink-0 pt-3 pr-3 text-right tabular-nums text-xs"
                  style={{ width: '52px', color: 'var(--color-graphite)' }}
                >
                  {formatTime(event.t)}
                </div>

                <div
                  className="flex-1 py-3 pl-4 pr-4"
                  style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-rule) 60%, transparent)' }}
                >
                  <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                    <span
                      className="text-xs"
                      style={{ color: KIND_COLORS[event.kind] }}
                    >
                      {event.kind}
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                      {event.subject}
                    </span>
                    {event.field && (
                      <span className="text-xs" style={{ color: 'var(--color-graphite)' }}>
                        {event.field}
                      </span>
                    )}
                  </div>

                  <p className="text-sm" style={{ color: 'var(--color-graphite)', maxWidth: '52ch' }}>
                    {event.summary}
                  </p>

                  {(event.from_value || event.to_value) && (
                    <div className="flex items-center gap-2 mt-1 text-xs tabular-nums" style={{ color: 'var(--color-graphite)' }}>
                      {event.from_value && <span>{event.from_value}</span>}
                      {event.from_value && event.to_value && (
                        <span style={{ color: 'var(--color-rule)' }}>→</span>
                      )}
                      {event.to_value && (
                        <span style={{ color: 'var(--color-ink)' }}>{event.to_value}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
