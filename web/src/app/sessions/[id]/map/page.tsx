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

function GuardrailRow({ guardrail }: { guardrail: Guardrail }) {
  return (
    <div
      style={{
        borderLeft: '2px solid var(--color-flag)',
        paddingLeft: '10px',
        marginBottom: '10px',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--color-flag)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '3px',
        }}
      >
        {guardrail.kind.replace('_', ' ')}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--color-ink)', marginBottom: '4px' }}>
        {guardrail.rule}
      </div>
      {guardrail.applies_to && (
        <div style={{ fontSize: '12px', color: 'var(--color-graphite)', marginBottom: '2px' }}>
          Applies to: {guardrail.applies_to}
        </div>
      )}
      {guardrail.who_to_ask && (
        <div style={{ fontSize: '12px', color: 'var(--color-graphite)', marginBottom: '2px' }}>
          Ask: {guardrail.who_to_ask}
        </div>
      )}
      <div
        style={{
          fontSize: '12px',
          color: 'var(--color-graphite)',
          fontStyle: 'italic',
          marginTop: '4px',
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
            color: 'var(--color-graphite)',
            fontStyle: 'normal',
          }}
        >
          [{fmtT(guardrail.quote_t)}]
        </button>
      </div>
    </div>
  )
}

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={snapSrc}
        alt={`Snapshot for ${step.title}`}
        style={{ width: '100%', display: 'block' }}
      />

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-ink)' }}>
            {step.title}
          </div>
          {step.is_judgment_call && (
            <span
              style={{
                fontSize: '11px',
                fontVariant: 'small-caps',
                color: 'var(--color-graphite)',
                letterSpacing: '0.04em',
              }}
            >
              judgment call
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: '13px',
            color: 'var(--color-ink)',
            marginBottom: '14px',
            borderBottom: '1px solid var(--color-rule)',
            paddingBottom: '14px',
          }}
        >
          {step.decision}
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-graphite)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px',
            }}
          >
            Reason
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-ink)', marginBottom: '6px' }}>
            {step.reason.text}
          </div>
          {step.reason.quote && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-graphite)',
                fontStyle: 'italic',
              }}
            >
              &ldquo;{step.reason.quote}&rdquo;
              {step.reason.quote_t !== null && (
                <button
                  onClick={() => step.reason.quote_t !== null && onSnapshotSelect(step.reason.quote_t)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0 4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: 'var(--color-graphite)',
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
            <div style={{ fontSize: '11px', color: 'var(--color-graphite)', marginTop: '4px' }}>
              Not confirmed by the expert
            </div>
          )}
        </div>

        {step.guardrails.length > 0 && (
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-graphite)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '8px',
              }}
            >
              Guardrails
            </div>
            {step.guardrails.map((g) => (
              <GuardrailRow key={g.id} guardrail={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

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
      .then((text) => { if (!cancelled) setPreview(text) })
      .catch((e: unknown) => { if (!cancelled) setErr(e instanceof Error ? e.message : 'Export failed') })
    return () => { cancelled = true }
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
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--color-panel)',
          border: '1px solid var(--color-rule)',
          borderRadius: '6px',
          width: 'min(760px, 95vw)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-rule)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-ink)' }}>
              Instructions for an agent
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-graphite)', marginTop: '2px' }}>
              Every step, hard stop, and gap — ready to load into an agent.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: 'var(--color-graphite)',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: '10px 18px',
            borderBottom: '1px solid var(--color-rule)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {(['markdown', 'json'] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFormatChange(f)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid var(--color-rule)',
                background: format === f ? 'var(--color-ink)' : 'none',
                color: format === f ? 'var(--color-paper)' : 'var(--color-ink)',
                cursor: 'pointer',
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
              padding: '4px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid var(--color-rule)',
              background: 'none',
              cursor: preview ? 'pointer' : 'default',
              color: 'var(--color-ink)',
              opacity: preview ? 1 : 0.5,
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            disabled={!preview}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid var(--color-rule)',
              background: 'none',
              cursor: preview ? 'pointer' : 'default',
              color: 'var(--color-ink)',
              opacity: preview ? 1 : 0.5,
            }}
          >
            Download
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px' }}>
          {fetching && (
            <div style={{ color: 'var(--color-graphite)', fontSize: '13px' }}>Loading…</div>
          )}
          {err && (
            <div style={{ color: 'var(--color-flag)', fontSize: '13px' }}>{err}</div>
          )}
          {preview && !fetching && (
            <pre
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: 'var(--color-ink)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
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
      style={{ height: '100dvh', backgroundColor: 'var(--color-paper)' }}
    >
      {showExport && id && (
        <ExportPanel sessionId={id} onClose={() => setShowExport(false)} />
      )}
      <header
        style={{ borderBottom: '1px solid var(--color-rule)' }}
        className="flex items-center justify-between px-5 py-3 bg-panel shrink-0"
      >
        <h1
          className="text-base font-medium tracking-tight"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            The AI Apprentice
          </Link>
        </h1>
        <div className="flex items-center gap-4">
          {workMap?.expert_confirmed && (
            <button
              onClick={() => setShowExport(true)}
              style={{
                fontSize: '13px',
                padding: '4px 12px',
                borderRadius: '4px',
                border: '1px solid var(--color-rule)',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--color-ink)',
              }}
            >
              Export
            </button>
          )}
          <Link
            href={`/sessions/${id}/privacy`}
            className="text-sm"
            style={{ color: 'var(--color-signal)', textDecoration: 'none' }}
          >
            Privacy
          </Link>
          <Link
            href={`/sessions/${id}`}
            className="text-sm"
            style={{ color: 'var(--color-signal)', textDecoration: 'none' }}
          >
            ← Session
          </Link>
        </div>
      </header>

      {error && (
        <p className="p-4 text-sm" style={{ color: 'var(--color-flag)' }}>
          {error}
        </p>
      )}

      {!workMap && !error && (
        <p className="p-4 text-sm" style={{ color: 'var(--color-graphite)' }}>
          Loading…
        </p>
      )}

      {workMap && (
        <>
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--color-rule)',
              background: 'var(--color-panel)',
            }}
          >
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-heading)',
                marginBottom: '2px',
              }}
            >
              {workMap.process_name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-graphite)', marginBottom: '2px' }}>
              {workMap.steps.length} steps · {judgmentCalls} judgment calls · {guardrailCount} guardrails
            </div>
            <div style={{ fontSize: '12px', color: workMap.expert_confirmed ? 'var(--color-signal)' : 'var(--color-graphite)' }}>
              {workMap.expert_confirmed
                ? `Confirmed by the expert${workMap.confirmed_at ? ` · ${fmtTimestamp(workMap.confirmed_at)}` : ''}`
                : 'Awaiting confirmation'}
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden min-h-0">
            <div
              style={{
                width: '320px',
                flexShrink: 0,
                borderRight: '1px solid var(--color-rule)',
                overflow: 'auto',
              }}
            >
              {workMap.steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    gap: '10px',
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--color-rule)',
                    borderLeft: selectedStepId === step.id ? '3px solid var(--color-signal)' : '3px solid transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
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
                    }}
                  >
                    {step.order}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-ink)',
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
                        color: 'var(--color-graphite)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {step.decision}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      {step.is_judgment_call && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontVariant: 'small-caps',
                            color: 'var(--color-graphite)',
                          }}
                        >
                          judgment call
                        </span>
                      )}
                      {step.guardrails.length > 0 && (
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--color-flag)',
                          }}
                        >
                          {step.guardrails.length} guardrail{step.guardrails.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
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
                    color: 'var(--color-graphite)',
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
