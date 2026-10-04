'use client'

import { useState } from 'react'

import type { ErpAction, Invoice, InvoiceStatus } from '@/lib/erp/types'

interface Props {
  invoice: Invoice
  dispatch: (action: ErpAction) => void
  pendingAction?: string | null
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: 'Open',
  held: 'On Hold',
  'awaiting-approval': 'Awaiting Approval',
  posted: 'Posted',
}

const STATUS_STYLE: Record<InvoiceStatus, { color: string; bg: string; border: string }> = {
  open: { color: '#c9d1d9', bg: 'rgba(201,209,217,0.08)', border: 'rgba(201,209,217,0.2)' },
  held: { color: '#e3b341', bg: 'rgba(227,179,65,0.1)', border: 'rgba(227,179,65,0.3)' },
  'awaiting-approval': { color: '#388bfd', bg: 'rgba(56,139,253,0.1)', border: 'rgba(56,139,253,0.3)' },
  posted: { color: '#3fb950', bg: 'rgba(63,185,80,0.1)', border: 'rgba(63,185,80,0.3)' },
}

function fmtAmount(amount: number): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function InvoiceDetail({ invoice, dispatch, pendingAction }: Props) {
  const [assetDraft, setAssetDraft] = useState(invoice.asset_number)
  const [noteDraft, setNoteDraft] = useState(invoice.internal_note)
  const { status } = invoice
  const ss = STATUS_STYLE[status]

  return (
    <div style={{ padding: '20px 24px', maxWidth: '640px' }}>
      <button
        onClick={() => dispatch({ type: 'BACK_TO_INBOX' })}
        style={linkBtn}
      >
        ← Invoice inbox
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#e6edf3', letterSpacing: '-0.01em' }}>
          {invoice.number}
        </h2>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 9px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          color: ss.color,
          background: ss.bg,
          border: `1px solid ${ss.border}`,
        }}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: '20px' }}>
        <Field label="Supplier" value={invoice.supplier} />
        <Field label="Country" value={invoice.country} />
        <Field label="Amount (EUR)" value={fmtAmount(invoice.amount)} mono />
        <Field label="Due Date" value={fmtDate(invoice.due_date)} />
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Description" value={invoice.description} />
        </div>
        <Field label="Contact Name" value={invoice.contact_name || '—'} />
        <Field label="Contact Email" value={invoice.contact_email || '—'} />
        <Field label="Contact Phone" value={invoice.contact_phone || '—'} />
        <Field label="Bank IBAN" value={invoice.bank_iban || '—'} mono />
      </div>

      <div style={{ borderTop: '1px solid #21262d', paddingTop: '16px', marginBottom: '20px' }}>
        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>Cost Center</label>
          <select
            value={invoice.cost_center}
            onChange={(e) =>
              dispatch({
                type: 'CHANGE_COST_CENTER',
                invoice_id: invoice.id,
                value: e.target.value as 'opex 4711' | 'capex 0400',
              })
            }
            disabled={pendingAction === 'CHANGE_COST_CENTER'}
            style={inputStyle}
          >
            <option value="opex 4711">opex 4711</option>
            <option value="capex 0400">capex 0400</option>
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>Asset Number</label>
          <input
            type="text"
            value={assetDraft}
            onChange={(e) => setAssetDraft(e.target.value)}
            onBlur={() => {
              if (assetDraft !== invoice.asset_number) {
                dispatch({ type: 'SET_ASSET_NUMBER', invoice_id: invoice.id, value: assetDraft })
              }
            }}
            placeholder="—"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Internal Note</label>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => {
              if (noteDraft !== invoice.internal_note) {
                dispatch({ type: 'SET_INTERNAL_NOTE', invoice_id: invoice.id, value: noteDraft })
              }
            }}
            rows={3}
            placeholder="—"
            style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.4' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {status === 'open' && (
          <>
            <ActionBtn
              label={pendingAction === 'HOLD' ? 'Checking…' : 'Place on Hold'}
              disabled={pendingAction !== null}
              onClick={() => dispatch({ type: 'HOLD', invoice_id: invoice.id })}
            />
            <ActionBtn
              label={pendingAction === 'SEND_FOR_APPROVAL' ? 'Checking…' : 'Send for Approval'}
              disabled={pendingAction !== null}
              onClick={() => dispatch({ type: 'SEND_FOR_APPROVAL', invoice_id: invoice.id })}
            />
            <ActionBtn
              label={pendingAction === 'POST' ? 'Checking…' : 'Post'}
              primary
              disabled={pendingAction !== null}
              onClick={() => dispatch({ type: 'POST', invoice_id: invoice.id })}
            />
          </>
        )}
        {status === 'held' && (
          <>
            <ActionBtn
              label={pendingAction === 'RELEASE_HOLD' ? 'Checking…' : 'Release Hold'}
              disabled={pendingAction !== null}
              onClick={() => dispatch({ type: 'RELEASE_HOLD', invoice_id: invoice.id })}
            />
            <ActionBtn
              label={pendingAction === 'POST' ? 'Checking…' : 'Post'}
              primary
              disabled={pendingAction !== null}
              onClick={() => dispatch({ type: 'POST', invoice_id: invoice.id })}
            />
          </>
        )}
        {status === 'awaiting-approval' && (
          <ActionBtn
            label={pendingAction === 'POST' ? 'Checking…' : 'Post'}
            primary
            disabled={pendingAction !== null}
            onClick={() => dispatch({ type: 'POST', invoice_id: invoice.id })}
          />
        )}
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: '#6e7681', marginBottom: '3px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        fontSize: '13px',
        color: '#c9d1d9',
        fontVariantNumeric: mono ? 'tabular-nums' : undefined,
        fontFamily: mono ? 'ui-monospace, monospace' : undefined,
      }}>
        {value}
      </div>
    </div>
  )
}

function ActionBtn({
  label,
  onClick,
  primary,
  disabled,
}: {
  label: string
  onClick: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '6px',
        border: primary ? 'none' : '1px solid #30363d',
        background: primary ? '#1f6feb' : 'transparent',
        color: primary ? '#ffffff' : '#c9d1d9',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s, background 0.15s',
      }}
    >
      {label}
    </button>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  color: '#6e7681',
  marginBottom: '5px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: '13px',
  border: '1px solid #30363d',
  borderRadius: '6px',
  background: '#0d1117',
  color: '#c9d1d9',
  outline: 'none',
  boxSizing: 'border-box',
}

const linkBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: '13px',
  color: '#388bfd',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  marginBottom: '4px',
}
