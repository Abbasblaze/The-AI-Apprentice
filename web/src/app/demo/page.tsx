'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { fetchApiStatus } from '@/lib/apiClient'
import type { ApiStatus } from '@/lib/types'

type CheckState = 'ok' | 'warn' | 'fail' | 'loading' | 'unknown'

interface CheckItem {
  label: string
  state: CheckState
  detail?: string
}

function StatusDot({ state }: { state: CheckState }) {
  const colors: Record<CheckState, string> = {
    ok: 'var(--color-ok)',
    warn: 'var(--color-flag)',
    fail: '#ef4444',
    loading: 'var(--color-graphite)',
    unknown: 'var(--color-graphite)',
  }
  const pulseRing: Record<CheckState, string> = {
    ok: 'rgba(34,197,94,0.25)',
    warn: 'rgba(245,158,11,0.25)',
    fail: 'rgba(239,68,68,0.25)',
    loading: 'transparent',
    unknown: 'transparent',
  }
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '18px',
        height: '18px',
        flexShrink: 0,
        marginTop: '1px',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: pulseRing[state],
        }}
      />
      <span
        style={{
          display: 'block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: colors[state],
          position: 'relative',
        }}
      />
    </span>
  )
}

function CheckRow({ item }: { item: CheckItem }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        padding: '10px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <StatusDot state={item.state} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: 'var(--color-ink)', fontWeight: 500 }}>
          {item.label}
        </div>
        {item.detail && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--color-graphite)',
              marginTop: '3px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {item.detail}
          </div>
        )}
      </div>
    </div>
  )
}

function StepRow({
  n,
  label,
  action,
}: {
  n: number
  label: string
  action?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start',
        padding: '12px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-ink-muted)',
          fontSize: '11px',
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-ink)', lineHeight: 1.55 }}>
        {label}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

function linkBtn(label: string, href: string) {
  return (
    <Link href={href} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '12px', padding: '4px 12px' }}>
      {label}
    </Link>
  )
}

interface ScenarioCardProps {
  title: string
  body: string
}

function ScenarioCard({ title, body }: ScenarioCardProps) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          color: 'var(--color-flag)',
          marginBottom: '8px',
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--color-ink-muted)', lineHeight: 1.6 }}>
        {body}
      </div>
    </div>
  )
}

interface PersonCardProps {
  role: string
  name: string
  description: string
}

function PersonCard({ role, name, description }: PersonCardProps) {
  return (
    <div
      className="glass-card"
      style={{ flex: 1, padding: '18px' }}
    >
      <div className="chip chip-signal" style={{ marginBottom: '10px' }}>
        {role}
      </div>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-ink)',
          marginBottom: '6px',
          fontFamily: 'var(--font-heading)',
        }}
      >
        {name}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--color-ink-muted)', lineHeight: 1.6 }}>
        {description}
      </div>
    </div>
  )
}

export default function DemoPage() {
  const [status, setStatus] = useState<ApiStatus | null>(null)
  const [apiErr, setApiErr] = useState(false)

  useEffect(() => {
    fetchApiStatus()
      .then(setStatus)
      .catch(() => setApiErr(true))
  }, [])

  const checks: CheckItem[] = [
    {
      label: 'API reachable (port 8000)',
      state: apiErr ? 'fail' : status ? 'ok' : 'loading',
      detail: apiErr ? 'Run: cd api && uvicorn main:app --reload --port 8000' : undefined,
    },
    {
      label: 'Web running',
      state: 'ok',
      detail: 'This page loaded.',
    },
    {
      label: 'Interview agent ID set',
      state: !status ? 'loading' : status.agents.interview ? 'ok' : 'warn',
      detail: !status?.agents.interview ? 'Set ELEVENLABS_AGENT_ID in api/.env' : undefined,
    },
    {
      label: 'Debrief agent ID set',
      state: !status ? 'loading' : status.agents.debrief ? 'ok' : 'warn',
      detail: !status?.agents.debrief ? 'Set ELEVENLABS_DEBRIEF_AGENT_ID in api/.env' : undefined,
    },
    {
      label: 'Tutor agent ID set',
      state: !status ? 'loading' : status.agents.tutor ? 'ok' : 'warn',
      detail: !status?.agents.tutor ? 'Set ELEVENLABS_TUTOR_AGENT_ID in api/.env' : undefined,
    },
    {
      label: 'Models configured',
      state: !status ? 'loading' : 'ok',
      detail: status
        ? `vision=${status.models.vision} · map=${status.models.map} · tutor=${status.models.tutor}`
        : undefined,
    },
    {
      label: 'Tesseract OCR found',
      state: !status ? 'loading' : status.tesseract ? 'ok' : 'warn',
      detail: !status?.tesseract
        ? 'Image redaction disabled. Install tesseract for full privacy features.'
        : undefined,
    },
    {
      label: 'Confirmed Work Map exists',
      state: !status ? 'loading' : status.confirmed_map ? 'ok' : 'warn',
      detail: !status?.confirmed_map
        ? 'Run a full session and confirm the map before the demo.'
        : status.confirmed_map_session_id
          ? `Session: ${status.confirmed_map_session_id}`
          : undefined,
    },
  ]

  const mapSessionId = status?.confirmed_map_session_id ?? ''

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-paper)' }}>
      {/* Header */}
      <header
        style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-panel)' }}
        className="flex items-center justify-between px-5 py-3"
      >
        <h1
          className="text-base font-medium tracking-tight"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            The AI Apprentice
          </Link>
        </h1>
        <span className="label-upper">Demo checklist</span>
      </header>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px 64px' }}>

        {/* Hero */}
        <div style={{ marginBottom: '40px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '26px',
              fontWeight: 700,
              color: 'var(--color-ink)',
              margin: '0 0 8px',
              letterSpacing: '-0.02em',
            }}
          >
            Demo Checklist
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-graphite)', margin: 0 }}>
            Verify environment, walk through the demo steps, and know your fallbacks.
          </p>
        </div>

        {/* Status checks */}
        <section style={{ marginBottom: '32px' }}>
          <div className="label-upper" style={{ marginBottom: '14px' }}>
            Status checks
          </div>
          <div className="glass-card" style={{ padding: '4px 20px' }}>
            {checks.map((c, i) => (
              <CheckRow key={i} item={c} />
            ))}
          </div>
        </section>

        {/* Demo steps */}
        <section style={{ marginBottom: '32px' }}>
          <div className="label-upper" style={{ marginBottom: '14px' }}>
            Demo steps
          </div>
          <div className="glass-card" style={{ padding: '4px 20px' }}>
            <StepRow
              n={1}
              label="Start the API (port 8000) and the web (port 3000)."
              action={
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-graphite)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  see README
                </span>
              }
            />

            <StepRow
              n={2}
              label="Open the ERP — Expert set. The expert (judge A) will use this window."
              action={linkBtn('Open ERP', '/erp?set=expert')}
            />

            <StepRow
              n={3}
              label="Reset the demo data. Clears tutor sessions; keeps the confirmed map."
              action={
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-graphite)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  scripts/reset_demo.sh
                </span>
              }
            />

            <StepRow
              n={4}
              label="Open the Apprentice window. This is the interviewer view."
              action={linkBtn('Open', '/')}
            />

            <StepRow
              n={5}
              label="Share the ERP window (screen share to the judge). Expert (judge A) starts processing the invoice."
            />

            <StepRow
              n={6}
              label="Run the task. The Apprentice asks questions when the expert pauses. Answer them out loud."
            />

            <StepRow
              n={7}
              label="End the session and run the debrief. The Apprentice will ask gap questions, then do a teachback."
              action={linkBtn('Sessions', '/sessions')}
            />

            <StepRow
              n={8}
              label="Open the confirmed Work Map. Show the steps, guardrail, and the Export button."
              action={
                mapSessionId
                  ? linkBtn('Open map', `/sessions/${mapSessionId}/map`)
                  : undefined
              }
            />

            <StepRow
              n={9}
              label="Open the ERP — New Hire set. New hire (judge B) will use this."
              action={linkBtn('Open ERP', '/erp?set=newhire')}
            />

            <StepRow
              n={10}
              label="Start the tutor. Judge B tries to process the invoice; the tutor blocks wrong actions."
              action={linkBtn('Tutor', '/tutor')}
            />
          </div>
        </section>

        {/* Fallback section */}
        <section style={{ marginBottom: '32px' }}>
          <div className="label-upper" style={{ marginBottom: '14px' }}>
            Fallback if voice or network fails
          </div>
          <div
            style={{
              background: 'var(--color-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap' as const,
              }}
            >
              <ScenarioCard
                title="Voice fails"
                body="The ERP events still fire and the director still runs. Type answers into the transcript box instead of speaking. The map will build the same way."
              />
              <ScenarioCard
                title="Network fails"
                body="Use the pre-loaded demo map (already confirmed). Open /sessions and pick the fixture session, then go straight to the map."
              />
              <ScenarioCard
                title="Model API slow"
                body="The tutor judge falls back to allow after 4 seconds and shows &quot;Tutor unavailable&quot;. The numeric guardrail check (opex/capex) is instant and always runs."
              />
            </div>
          </div>
        </section>

        {/* Roles section */}
        <section>
          <div className="label-upper" style={{ marginBottom: '14px' }}>
            Roles
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const }}>
            <PersonCard
              role="Judge A"
              name="Expert"
              description="Uses the ERP Expert set. Processes the invoice, answers Apprentice questions. Confirms the teachback."
            />
            <PersonCard
              role="Judge B"
              name="New Hire"
              description="Uses the ERP New Hire set. Tries to process the invoice during tutor mode. The tutor blocks the opex error."
            />
            <PersonCard
              role="Presenter"
              name="Demonstrator"
              description="Drives the Apprentice window and explains what is happening to the judges."
            />
          </div>
        </section>

      </div>
    </div>
  )
}
