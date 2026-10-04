'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { fetchLearnMaps } from '@/lib/apiClient'
import { ModeHeader } from '@/components/ModeHeader'
import type { LearnMapSummary } from '@/lib/apiClient'

export default function LearnPage() {
  const [maps, setMaps] = useState<LearnMapSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLearnMaps()
      .then(setMaps)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load maps'),
      )
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
      <ModeHeader mode="learner" />

      <main
        style={{
          flex: 1,
          padding: '28px 24px',
          maxWidth: '900px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div style={{ marginBottom: '28px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--color-ink)',
              marginBottom: '6px',
            }}
          >
            Choose a process to practise
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-graphite)', margin: 0 }}>
            The tutor will watch your ERP actions and guide you in real time.
          </p>
        </div>

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-flag)' }}>
            {error}
          </p>
        )}

        {maps === null && !error && (
          <p className="text-sm" style={{ color: 'var(--color-graphite)' }}>
            Loading…
          </p>
        )}

        {maps !== null && maps.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--color-graphite)' }}>
            No confirmed or demo-ready work maps found.
          </p>
        )}

        {maps !== null && maps.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '14px',
            }}
          >
            {maps.map((map) => (
              <Link
                key={map.session_id}
                href={`/learn/${map.session_id}`}
                className="glass-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  textDecoration: 'none',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--color-ink)',
                      marginBottom: '8px',
                      fontFamily: 'var(--font-heading)',
                      lineHeight: 1.3,
                    }}
                  >
                    {map.process_name}
                  </div>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}
                  >
                    <span
                      className="chip chip-neutral"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}
                    >
                      {map.step_count} steps
                    </span>
                    {map.guardrail_count > 0 && (
                      <span
                        className="chip chip-neutral"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}
                      >
                        {map.guardrail_count} guardrails
                      </span>
                    )}
                    {map.expert_confirmed && (
                      <span className="chip chip-ok">
                        <span style={{ marginRight: '3px' }}>&#10003;</span> Confirmed
                      </span>
                    )}
                    {map.demo_ready && !map.expert_confirmed && (
                      <span className="chip chip-signal">Demo</span>
                    )}
                  </div>
                </div>
                <div className="btn-primary" style={{ textAlign: 'center' }}>
                  Start tutoring
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
