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
      className="flex items-center justify-between shrink-0"
      style={{
        height: '52px',
        padding: '0 20px',
        background: 'rgba(10,13,20,0.96)',
        borderBottom: '1px solid var(--color-border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '7px',
            background: 'linear-gradient(135deg, #3d7eff 0%, #7c3aed 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.5" fill="white" />
            <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.2" strokeOpacity="0.5" fill="none" />
          </svg>
        </span>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--color-ink)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          AI Apprentice
        </span>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-5">
        <nav className="flex items-center gap-4">
          <Link href="/expert/sessions" className="nav-link">Sessions</Link>
          <Link href="/demo" className="nav-link">Demo</Link>
          <div style={{ width: '1px', height: '16px', background: 'var(--color-border)' }} />
          <Link
            href="/learn"
            style={{
              fontSize: '12px',
              color: 'var(--color-ink-muted)',
              textDecoration: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: '5px',
              padding: '3px 10px',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            Learner mode
          </Link>
        </nav>

        {/* Separator */}
        {(chip || isOffRecordActive || isSharing) && (
          <div style={{ width: '1px', height: '16px', background: 'var(--color-border)' }} />
        )}

        {/* Voice mode chip */}
        {chip && (
          <span
            className="chip"
            style={{
              background: chip.bg,
              color: chip.text,
              border: `1px solid ${chip.dot}33`,
              borderRadius: '20px',
            }}
          >
            <span
              className="live-dot inline-block w-1.5 h-1.5 rounded-full mr-1"
              style={{ backgroundColor: chip.dot }}
            />
            {chip.label}
          </span>
        )}

        {/* Off-record badge */}
        {isOffRecordActive && (
          <span className="chip chip-flag">
            off the record
          </span>
        )}

        {/* Elapsed timer */}
        {isSharing && (
          <div
            className="flex items-center gap-2"
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span
              className="live-dot inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: '#ef4444' }}
            />
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-ink-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatElapsed(elapsed)}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
