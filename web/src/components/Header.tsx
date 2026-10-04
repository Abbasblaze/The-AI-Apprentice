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

const VOICE_CHIP: Record<
  Exclude<VoiceMode, 'idle' | 'off-record'>,
  { label: string; bg: string; dot: string; text: string }
> = {
  listening: {
    label: 'listening',
    bg: 'rgba(16,185,129,0.12)',
    dot: '#10b981',
    text: '#34d399',
  },
  speaking: {
    label: 'speaking',
    bg: 'rgba(59,130,246,0.12)',
    dot: '#3b82f6',
    text: '#60a5fa',
  },
  waiting: {
    label: 'waiting',
    bg: 'rgba(245,158,11,0.12)',
    dot: '#f59e0b',
    text: '#fbbf24',
  },
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

  const isOffRecordActive = isOffRecord || voiceMode === 'off-record'
  const chip =
    !isOffRecordActive && voiceMode !== 'idle'
      ? VOICE_CHIP[voiceMode as Exclude<VoiceMode, 'idle' | 'off-record'>] ?? null
      : null

  return (
    <header
      className="flex items-center justify-between px-5 shrink-0"
      style={{
        height: '52px',
        background: 'rgba(10,13,20,0.95)',
        borderBottom: '1px solid #1e2533',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{ textDecoration: 'none' }}
      >
        <span
          className="text-base font-semibold tracking-tight"
          style={{
            background: 'linear-gradient(90deg, #3d7eff 0%, #7c3aed 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: 'var(--font-heading)',
          }}
        >
          The AI Apprentice
        </span>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <Link
          href="/sessions"
          className="text-sm transition-colors"
          style={{ color: '#8a94a8', textDecoration: 'none' }}
          onMouseEnter={e => ((e.target as HTMLElement).style.color = '#c9d1e0')}
          onMouseLeave={e => ((e.target as HTMLElement).style.color = '#8a94a8')}
        >
          Sessions
        </Link>

        <Link
          href="/demo"
          className="text-sm transition-colors"
          style={{ color: '#8a94a8', textDecoration: 'none' }}
          onMouseEnter={e => ((e.target as HTMLElement).style.color = '#c9d1e0')}
          onMouseLeave={e => ((e.target as HTMLElement).style.color = '#8a94a8')}
        >
          Demo
        </Link>

        {/* Voice mode chip */}
        {chip && (
          <span
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background: chip.bg,
              color: chip.text,
              border: `1px solid ${chip.dot}33`,
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: chip.dot }}
            />
            {chip.label}
          </span>
        )}

        {/* Off-record badge */}
        {isOffRecordActive && (
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              color: '#f87171',
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            off the record
          </span>
        )}

        {/* Elapsed timer */}
        {isSharing && (
          <div className="flex items-center gap-2">
            <span
              className="live-dot inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: '#ef4444' }}
            />
            <span
              className="text-sm tabular-nums"
              style={{ color: '#8a94a8', fontVariantNumeric: 'tabular-nums' }}
            >
              {formatElapsed(elapsed)}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
