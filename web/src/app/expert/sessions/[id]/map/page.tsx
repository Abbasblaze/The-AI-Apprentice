'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { exportMap, fetchMap, snapshotUrl } from '@/lib/apiClient'
import type { Guardrail, Step, WorkMap } from '@/lib/types'

function fmtT(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function fmtTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ── Guardrail card ───────────────────────────────────────────────────── */

function GuardrailRow({ guardrail }: { guardrail: Guardrail }) {
  return (
    <div
      style={{
        borderLeft: '3px solid #f59e0b',
        background: 'rgba(245,158,11,0.06)',
        borderRadius: '0 6px 6px 0',
        padding: '10px 14px',
        marginBottom: '10px',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#f59e0b',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: '4px',
        }}
      >
        {guardrail.kind.replace('_', ' ')}
      </div>
      <div style={{ fontSize: '13px', color: '#e2e8f0', marginBottom: '5px', lineHeight: 1.45 }}>
        {guardrail.rule}
      </div>
      {guardrail.applies_to && (
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>
          Applies to: {guardrail.applies_to}
        </div>
      )}
      {guardrail.who_to_ask && (
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>
          Ask: {guardrail.who_to_ask}
        </div>
      )}
      <div
        style={{
          fontSize: '12px',
          color: '#64748b',
          fontStyle: 'italic',
          marginTop: '5px',
          lineHeight: 1.4,
        }}
      >
        &ldquo;{guardrail.quote}&rdquo;
        <button
          style={{
            background: 'none',
            border: 'none',
            padding: '0 4px',
            cursor: 'default',
            fontSize: '11px',
            color: '#64748b',
            fontStyle: 'normal',
          }}
        >
          [{fmtT(guardrail.quote_t)}]
        </button>
      </div>
    </div>
  )
}

/* ── Section label ────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '10px',
        fontWeight: 700,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        marginBottom: '6px',
      }}
    >
      {children}
    </div>
  )
}

/* ── Dark info card ───────────────────────────────────────────────────── */

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '12px 14px',
        marginBottom: '10px',
      }}
    >
      {children}
    </div>
  )
}

/* ── Step detail pane ─────────────────────────────────────────────────── */

function StepDetail({
  step,
  sessionId,
  onSnapshotSelect,
}: {
  step: Step
  sessionId: string
  onSnapshotSelect: (t: number) => void
}) {
  const snapSrc = snapshotUrl(sessionId, step.screen_moment.snapshot_t)

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '0' }}>
      {/* Snapshot */}
      <div style={{ position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={snapSrc}
          alt={`Snapshot for ${step.title}`}
          style={{
            width: '100%',
            display: 'block',
            borderRadius: '0 0 10px 10px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '14px',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            borderRadius: '5px',
            padding: '3px 8px',
            fontSize: '11px',
            color: '#cbd5e1',
          }}
        >
          {step.screen_moment.subject}
        </div>
      </div>

      <div style={{ padding: '18px 20px' }}>
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '14px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#f1f5f9',
              letterSpacing: '-0.01em',
            }}
          >
            {step.title}
          </div>
          {step.is_judgment_call && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                background: 'rgba(168,85,247,0.15)',
                color: '#c084fc',
                border: '1px solid rgba(168,85,247,0.3)',
                borderRadius: '4px',
                padding: '2px 7px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Judgment call
            </span>
          )}
        </div>

        {/* Decision */}
        <div style={{ marginBottom: '10px' }}>
          <SectionLabel>Decision</SectionLabel>
          <InfoCard>
            <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.55 }}>
              {step.decision}
            </div>
          </InfoCard>
        </div>

        {/* Reason */}
        <div style={{ marginBottom: '10px' }}>
          <SectionLabel>Reason</SectionLabel>
          <InfoCard>
            <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.55, marginBottom: step.reason.quote ? '8px' : '0' }}>
              {step.reason.text}
            </div>
            {step.reason.quote && (
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontStyle: 'italic',
                  lineHeight: 1.4,
                }}
              >
                &ldquo;{step.reason.quote}&rdquo;
                {step.reason.quote_t !== null && (
                  <button
                    onClick={() =>
                      step.reason.quote_t !== null && onSnapshotSelect(step.reason.quote_t)
                    }
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0 4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: '#475569',
                      fontStyle: 'normal',
                      textDecoration: 'underline',
                    }}
                  >
                    [{fmtT(step.reason.quote_t)}]
                  </button>
                )}
              </div>
            )}
            {step.reason.unconfirmed && (
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  marginTop: '6px',
                  fontStyle: 'italic',
                }}
              >
                Not confirmed by the expert
              </div>
            )}
          </InfoCard>
        </div>

        {/* Expert said (open gaps) */}
        {step.open_gaps.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <SectionLabel>Expert said</SectionLabel>
            <InfoCard>
              {step.open_gaps.map((gap, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '13px',
                    color: '#94a3b8',
                    lineHeight: 1.5,
                    marginBottom: i < step.open_gaps.length - 1 ? '6px' : '0',
                  }}
                >
                  {gap}
                </div>
              ))}
            </InfoCard>
          </div>
        )}

        {/* Guardrails */}
        {step.guardrails.length > 0 && (
          <div>
            <SectionLabel>Guardrails</SectionLabel>
            {step.guardrails.map((g) => (
              <GuardrailRow key={g.id} guardrail={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Export panel modal ───────────────────────────────────────────────── */

function ExportPanel({
  sessionId,
  onClose,
}: {
  sessionId: string
  onClose: () => void
}) {
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown')
  const [preview, setPreview] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const fetching = preview === null && err === null

  useEffect(() => {
    let cancelled = false
    exportMap(sessionId, format)
      .then((text) => {
        if (!cancelled) setPreview(text)
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Export failed')
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, format])

  function handleFormatChange(f: 'markdown' | 'json') {
    setPreview(null)
    setErr(null)
    setFormat(f)
  }

  function handleCopy() {
    if (!preview) return
    navigator.clipboard.writeText(preview).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleDownload() {
    if (!preview) return
    const ext = format === 'json' ? 'json' : 'md'
    const mime = format === 'json' ? 'application/json' : 'text/markdown'
    const blob = new Blob([preview], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-instructions.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          width: 'min(760px, 95vw)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#f1f5f9' }}>
              Instructions for an agent
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
              Every step, hard stop, and gap — ready to load into an agent.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid #334155',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#94a3b8',
              lineHeight: 1,
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {(['markdown', 'json'] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFormatChange(f)}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '5px',
                border: '1px solid',
                borderColor: format === f ? '#3b82f6' : '#334155',
                background: format === f ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: format === f ? '#93c5fd' : '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f === 'markdown' ? 'Markdown' : 'JSON'}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={handleCopy}
            disabled={!preview}
            style={{
              padding: '4px 14px',
              fontSize: '12px',
              borderRadius: '5px',
              border: '1px solid #334155',
              background: 'transparent',
              cursor: preview ? 'pointer' : 'default',
              color: preview ? '#cbd5e1' : '#475569',
              opacity: preview ? 1 : 0.5,
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            disabled={!preview}
            style={{
              padding: '4px 14px',
              fontSize: '12px',
              borderRadius: '5px',
              border: '1px solid #334155',
              background: 'transparent',
              cursor: preview ? 'pointer' : 'default',
              color: preview ? '#cbd5e1' : '#475569',
              opacity: preview ? 1 : 0.5,
            }}
          >
            Download
          </button>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {fetching && (
            <div style={{ color: '#64748b', fontSize: '13px' }}>Loading…</div>
          )}
          {err && (
            <div style={{ color: '#f87171', fontSize: '13px' }}>{err}</div>
          )}
          {preview && !fetching && (
            <pre
              style={{
                fontFamily: 'ui-monospace, "Fira Code", monospace',
                fontSize: '12px',
                color: '#94a3b8',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {preview}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function MapPage() {
  const { id } = useParams<{ id: string }>()
  const [workMap, setWorkMap] = useState<WorkMap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchMap(id)
      .then((m) => {
        setWorkMap(m)
        if (m.steps.length > 0) setSelectedStepId(m.steps[0].id)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load map'),
      )
  }, [id])

  const selectedStep = workMap?.steps.find((s) => s.id === selectedStepId) ?? null
  const judgmentCalls = workMap?.steps.filter((s) => s.is_judgment_call).length ?? 0
  const guardrailCount = workMap?.steps.reduce((n, s) => n + s.guardrails.length, 0) ?? 0

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', background: '#0a0f1e' }}
    >
      {showExport && id && (
        <ExportPanel sessionId={id} onClose={() => setShowExport(false)} />
      )}

      {/* ── Header ── */}
      <header
        style={{
          borderBottom: '1px solid #1e293b',
          background: '#0d1424',
          flexShrink: 0,
        }}
        className="flex items-center justify-between px-5 py-3"
      >
        <h1
          className="text-base font-semibold tracking-tight"
          style={{ color: '#f1f5f9', fontFamily: 'var(--font-heading)' }}
        >
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            The AI Apprentice
          </Link>
        </h1>
        <div className="flex items-center gap-3">
          {workMap?.expert_confirmed && (
            <button
              onClick={() => setShowExport(true)}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '5px 14px',
                borderRadius: '6px',
                border: '1px solid #334155',
                background: 'transparent',
                cursor: 'pointer',
                color: '#cbd5e1',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.borderColor = '#475569'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = '#334155'
              }}
            >
              Export
            </button>
          )}
          <Link
            href={`/expert/sessions/${id}/privacy`}
            style={{
              fontSize: '13px',
              color: '#64748b',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
          >
            Privacy
          </Link>
          <Link
            href={`/expert/sessions/${id}`}
            style={{
              fontSize: '13px',
              color: '#64748b',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
          >
            Session
          </Link>
        </div>
      </header>

      {/* ── Error / Loading ── */}
      {error && (
        <p className="p-4 text-sm" style={{ color: '#f87171' }}>
          {error}
        </p>
      )}
      {!workMap && !error && (
        <p className="p-4 text-sm" style={{ color: '#475569' }}>
          Loading…
        </p>
      )}

      {/* ── Content ── */}
      {workMap && (
        <>
          {/* Map meta bar */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid #1e293b',
              background: '#0d1424',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#f1f5f9',
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '-0.01em',
                }}
              >
                {workMap.process_name}
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                {workMap.steps.length} steps · {judgmentCalls} judgment call{judgmentCalls !== 1 ? 's' : ''} · {guardrailCount} guardrail{guardrailCount !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            {workMap.expert_confirmed ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(34,197,94,0.12)',
                  color: '#4ade80',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: '20px',
                  padding: '3px 10px',
                  whiteSpace: 'nowrap',
                }}
              >
                Confirmed{workMap.confirmed_at ? ` · ${fmtTimestamp(workMap.confirmed_at)}` : ''}
              </span>
            ) : (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(100,116,139,0.12)',
                  color: '#64748b',
                  border: '1px solid rgba(100,116,139,0.2)',
                  borderRadius: '20px',
                  padding: '3px 10px',
                }}
              >
                Awaiting confirmation
              </span>
            )}
          </div>

          {/* ── Two-column layout ── */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Steps sidebar */}
            <div
              style={{
                width: '300px',
                flexShrink: 0,
                borderRight: '1px solid #1e293b',
                overflow: 'auto',
                background: '#0a0f1e',
              }}
            >
              {workMap.steps.map((step) => {
                const active = selectedStepId === step.id
                return (
                  <button
                    key={step.id}
                    onClick={() => setSelectedStepId(step.id)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      gap: '10px',
                      padding: '10px 12px',
                      background: active ? '#1e293b' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #1e293b',
                      borderLeft: `3px solid ${active ? '#3b82f6' : 'transparent'}`,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {/* Order circle */}
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: active
                          ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                          : 'linear-gradient(135deg, #1e3a5f, #2d2f6b)',
                        color: active ? '#fff' : '#93c5fd',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}
                    >
                      {step.order}
                    </div>

                    {/* Step info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: active ? '#f1f5f9' : '#cbd5e1',
                          marginBottom: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {step.title}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#64748b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: '5px',
                        }}
                      >
                        {step.decision}
                      </div>
                      {(step.is_judgment_call || step.guardrails.length > 0) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          {step.guardrails.length > 0 && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                background: 'rgba(245,158,11,0.12)',
                                color: '#fbbf24',
                                border: '1px solid rgba(245,158,11,0.25)',
                                borderRadius: '4px',
                                padding: '1px 6px',
                              }}
                            >
                              {step.guardrails.length} guardrail{step.guardrails.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {step.is_judgment_call && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                background: 'rgba(168,85,247,0.12)',
                                color: '#c084fc',
                                border: '1px solid rgba(168,85,247,0.25)',
                                borderRadius: '4px',
                                padding: '1px 6px',
                              }}
                            >
                              Judgment
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Step detail */}
            <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, background: '#0a0f1e' }}>
              {selectedStep ? (
                <StepDetail
                  step={selectedStep}
                  sessionId={id ?? ''}
                  onSnapshotSelect={(t) => {
                    const nearest = workMap.steps.find(
                      (s) => Math.abs(s.screen_moment.snapshot_t - t) < 1,
                    )
                    if (nearest) setSelectedStepId(nearest.id)
                  }}
                />
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#475569',
                    fontSize: '13px',
                  }}
                >
                  Select a step to view details.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
