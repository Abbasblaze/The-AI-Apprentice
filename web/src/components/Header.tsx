'use client'

import { useEffect, useState } from 'react'

interface Props {
  isSharing: boolean
  startTimeRef: React.RefObject<number>
}

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0')
  const ss = (seconds % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export function Header({ isSharing, startTimeRef }: Props) {
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
        </div>
      )}
    </header>
  )
}
