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

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  open: '#1A1A1A',
  held: '#B45309',
  'awaiting-approval': '#1D4ED8',
  posted: '#15803D',
}

function fmtAmount(amount: number): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    amount,
  )
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function InvoiceDetail({ invoice, dispatch, pendingAction }: Props) {
  const [assetDraft, setAssetDraft] = useState(invoice.asset_number)
  const [noteDraft, setNoteDraft] = useState(invoice.internal_note)
  const { status } = invoice

  return (
    <div style={{ padding: '20px 24px', maxWidth: '640px' }}>
      <button
        onClick={() => dispatch({ type: 'BACK_TO_INBOX' })}
        style={{ ...linkBtn, marginBottom: '16px' }}
      >
        ← Invoice inbox
      </button>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{invoice.number}</h2>
        <span style={{ fontSize: '13px', color: STATUS_COLOR[status], fontWeight: 500 }}>
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
      </div>

      <div style={{ borderTop: '1px solid #D0D0CE', paddingTop: '16px', marginBottom: '20px' }}>
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
      <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', color: '#1A1A1A', fontVariantNumeric: mono ? 'tabular-nums' : undefined }}>
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
        borderRadius: '2px',
        border: primary ? 'none' : '1px solid #C0C0BE',
        background: primary ? '#2563EB' : '#FFFFFF',
        color: primary ? '#FFFFFF' : '#1A1A1A',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: '#6B7280',
  marginBottom: '4px',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: '13px',
  border: '1px solid #C8C8C6',
  borderRadius: '2px',
  background: '#FFFFFF',
  color: '#1A1A1A',
  outline: 'none',
  boxSizing: 'border-box',
}

const linkBtn: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '13px',
  color: '#2563EB',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
}
