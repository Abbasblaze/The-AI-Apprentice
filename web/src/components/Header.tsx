'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { VoiceMode } from '@/lib/types'

interface Props {
  isSharing: boolean
  startTimeRef: React.RefObject<number>
  voiceMode: VoiceMode
  isOffRecord: boolean
}

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0')
  const ss = (seconds % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

const VOICE_LABELS: Record<VoiceMode, string> = {
  idle: '',
  listening: 'listening',
  speaking: 'speaking',
  waiting: 'waiting for answer',
  'off-record': 'off the record',
}

export function Header({ isSharing, startTimeRef, voiceMode, isOffRecord }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isSharing) return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => {
      clearInterval(id)
      setElapsed(0)
    }
  }, [isSharing, startTimeRef])

  const voiceLabel = VOICE_LABELS[voiceMode]
  const isOffRecordActive = isOffRecord || voiceMode === 'off-record'

  return (
    <header
      style={{ borderBottom: '1px solid var(--color-rule)' }}
      className="flex items-center justify-between px-5 py-3 bg-panel shrink-0"
    >
      <h1
        className="text-base font-medium tracking-tight"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        The AI Apprentice
      </h1>

      <div className="flex items-center gap-4">
        <Link
          href="/sessions"
          className="text-sm"
          style={{ color: 'var(--color-graphite)', textDecoration: 'none' }}
        >
          Sessions
        </Link>

        {isOffRecordActive && (
          <span
            className="text-xs px-2 py-0.5"
            style={{
              color: 'var(--color-flag)',
              border: '1px solid var(--color-flag)',
              borderRadius: '3px',
            }}
          >
            off the record
          </span>
        )}

        {isSharing && (
          <div className="flex items-center gap-2">
            <span
              className="live-dot inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--color-signal)' }}
            />
            <span
              className="text-sm tabular-nums"
              style={{ color: 'var(--color-graphite)' }}
            >
              {formatElapsed(elapsed)}
            </span>
            {voiceLabel && (
              <span
                className="text-xs"
                style={{ color: 'var(--color-graphite)' }}
              >
                · {voiceLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
