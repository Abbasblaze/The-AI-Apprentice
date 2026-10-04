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
    ok: '#22c55e',
    warn: '#f59e0b',
    fail: '#ef4444',
    loading: '#9ca3af',
    unknown: '#9ca3af',
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: colors[state],
        flexShrink: 0,
        marginTop: '4px',
      }}
    />
  )
}

function CheckRow({ item }: { item: CheckItem }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        padding: '8px 0',
        borderBottom: '1px solid var(--color-rule)',
      }}
    >
      <StatusDot state={item.state} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: 'var(--color-ink)' }}>{item.label}</div>
        {item.detail && (
          <div style={{ fontSize: '11px', color: 'var(--color-graphite)', marginTop: '2px' }}>
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
        gap: '12px',
        alignItems: 'flex-start',
        padding: '10px 0',
        borderBottom: '1px solid var(--color-rule)',
      }}
    >
      <div
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: 'var(--color-ink)',
          color: 'var(--color-paper)',
          fontSize: '11px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-ink)' }}>{label}</div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

function linkBtn(label: string, href: string) {
  return (
    <Link
      href={href}
      style={{
        fontSize: '12px',
        padding: '3px 10px',
        borderRadius: '4px',
        border: '1px solid var(--color-rule)',
        color: 'var(--color-ink)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Link>
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
      detail: status ? `vision=${status.models.vision} · map=${status.models.map} · tutor=${status.models.tutor}` : undefined,
    },
    {
      label: 'Tesseract OCR found',
      state: !status ? 'loading' : status.tesseract ? 'ok' : 'warn',
      detail: !status?.tesseract ? 'Image redaction disabled. Install tesseract for full privacy features.' : undefined,
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
      <header
        style={{ borderBottom: '1px solid var(--color-rule)' }}
        className="flex items-center justify-between px-5 py-3 bg-panel"
      >
        <h1
          className="text-base font-medium tracking-tight"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            The AI Apprentice
          </Link>
        </h1>
        <span className="text-sm" style={{ color: 'var(--color-graphite)' }}>
          Demo checklist
        </span>
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 20px' }}>

        <section style={{ marginBottom: '32px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-graphite)',
              marginBottom: '12px',
            }}
          >
            Status checks
          </div>
          {checks.map((c, i) => (
            <CheckRow key={i} item={c} />
          ))}
        </section>

        <section style={{ marginBottom: '32px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-graphite)',
              marginBottom: '12px',
            }}
          >
            Demo steps
          </div>

          <StepRow
            n={1}
            label="Start the API (port 8000) and the web (port 3000)."
            action={
              <span style={{ fontSize: '11px', color: 'var(--color-graphite)', fontFamily: 'monospace' }}>
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
              <span style={{ fontSize: '12px', color: 'var(--color-graphite)', fontFamily: 'monospace' }}>
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
        </section>

        <section style={{ marginBottom: '32px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-graphite)',
              marginBottom: '12px',
            }}
          >
            Fallback if voice or network fails
          </div>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--color-ink)',
              lineHeight: 1.6,
              padding: '12px',
              border: '1px solid var(--color-rule)',
              borderRadius: '4px',
            }}
          >
            <div style={{ marginBottom: '6px' }}>
              <strong>Voice fails:</strong> The ERP events still fire and the director still runs.
              Type answers into the transcript box instead of speaking. The map will build the same way.
            </div>
            <div style={{ marginBottom: '6px' }}>
              <strong>Network fails:</strong> Use the pre-loaded demo map (already confirmed).
              Open /sessions and pick the fixture session, then go straight to the map.
            </div>
            <div>
              <strong>Model API slow:</strong> The tutor judge falls back to allow after 4 seconds
              and shows &ldquo;Tutor unavailable&rdquo;. The numeric guardrail check (opex/capex) is instant and always runs.
            </div>
          </div>
        </section>

        <section>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-graphite)',
              marginBottom: '12px',
            }}
          >
            Roles
          </div>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--color-ink)',
              lineHeight: 1.7,
              padding: '12px',
              border: '1px solid var(--color-rule)',
              borderRadius: '4px',
            }}
          >
            <div><strong>Judge A (Expert):</strong> Uses the ERP Expert set. Processes the invoice, answers Apprentice questions. Confirms the teachback.</div>
            <div><strong>Judge B (New Hire):</strong> Uses the ERP New Hire set. Tries to process the invoice during tutor mode. The tutor blocks the opex error.</div>
            <div><strong>Presenter:</strong> Drives the Apprentice window and explains what is happening.</div>
          </div>
        </section>

      </div>
    </div>
  )
}
