'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { checkAction } from '@/lib/apiClient'
import { InvoiceDetail } from '@/components/erp/InvoiceDetail'
import { InvoiceInbox } from '@/components/erp/InvoiceInbox'
import { broadcastErpEvents, broadcastTutorBlock } from '@/lib/erp/broadcast'
import { defaultCommitGuard } from '@/lib/erp/commitGuard'
import { erpReducer, toErpEvents } from '@/lib/erp/reducer'
import { SEEDS } from '@/lib/erp/seeds'
import type { CommitGuard } from '@/lib/erp/commitGuard'
import type { ErpAction, ErpState, Invoice, SeedSet } from '@/lib/erp/types'
import type { InvoiceStateIn } from '@/lib/apiClient'

const LS_KEY = 'ai-apprentice-erp-state'

const CHECKED_ACTION_TYPES = new Set([
  'CHANGE_COST_CENTER',
  'SET_ASSET_NUMBER',
  'HOLD',
  'RELEASE_HOLD',
  'SEND_FOR_APPROVAL',
  'POST',
])

function invoiceToStateIn(invoice: Invoice): InvoiceStateIn {
  return {
    supplier: invoice.supplier,
    country: invoice.country,
    amount: invoice.amount,
    cost_center: invoice.cost_center,
    asset_number: invoice.asset_number,
    status: invoice.status,
    internal_note: invoice.internal_note,
  }
}

function actionToCheck(action: ErpAction): { action_type: string; action_value: string | null } {
  const type = action.type.toLowerCase()
  let value: string | null = null
  if ('value' in action) value = String(action.value)
  return { action_type: type, action_value: value }
}

interface ErpAppProps {
  commitGuard?: CommitGuard
}

function ErpApp({ commitGuard = defaultCommitGuard }: ErpAppProps) {
  const searchParams = useSearchParams()
  const seedSet = (searchParams.get('set') ?? 'expert') as SeedSet
  const tutorId = searchParams.get('tutor')

  const [state, setState] = useState<ErpState>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { seedSet: SeedSet; state: ErpState }
        if (parsed.seedSet === seedSet) return parsed.state
      }
    } catch { /* ignore */ }
    return JSON.parse(JSON.stringify(SEEDS[seedSet])) as ErpState
  })
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const stateRef = useRef<ErpState>(state)

  useEffect(() => {
    stateRef.current = state
  })

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ seedSet, state }))
    } catch { /* ignore */ }
  }, [state, seedSet])

  const applyAction = useCallback(
    (action: ErpAction) => {
      const current = stateRef.current
      const invoice =
        'invoice_id' in action
          ? current.invoices.find((inv) => inv.id === action.invoice_id) ?? null
          : null

      const result = commitGuard(action, invoice)
      if (result.decision === 'deny') return

      const events = toErpEvents(action, current)
      const next = erpReducer(current, action)
      stateRef.current = next
      setState(next)

      if (events.length > 0) {
        broadcastErpEvents(events)
      }
    },
    [commitGuard],
  )

  const dispatch = useCallback(
    (action: ErpAction) => {
      if (!tutorId || !CHECKED_ACTION_TYPES.has(action.type)) {
        applyAction(action)
        return
      }

      const current = stateRef.current
      const invoice =
        'invoice_id' in action
          ? current.invoices.find((inv) => inv.id === action.invoice_id) ?? null
          : null

      if (!invoice) {
        applyAction(action)
        return
      }

      setPendingAction(action.type)
      const { action_type, action_value } = actionToCheck(action)

      checkAction(tutorId, { action_type, action_value }, invoiceToStateIn(invoice))
        .then((verdict) => {
          setPendingAction(null)
          if (verdict.verdict === 'block') {
            broadcastTutorBlock(verdict)
          } else {
            applyAction(action)
          }
        })
        .catch(() => {
          setPendingAction(null)
          applyAction(action)
        })
    },
    [tutorId, applyAction],
  )

  const selectedInvoice =
    state.view === 'detail' && state.selected_invoice_id
      ? state.invoices.find((inv) => inv.id === state.selected_invoice_id) ?? null
      : null

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d1117', color: '#c9d1d9' }}>
      <header
        style={{
          borderBottom: '1px solid #21262d',
          padding: '0 20px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#161b22',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            display: 'inline-block',
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #1f6feb 0%, #388bfd 100%)',
            flexShrink: 0,
          }} />
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#e6edf3', letterSpacing: '-0.01em' }}>
            APEX Financial Workflow
          </span>
          {tutorId && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: '20px',
              background: 'rgba(56,139,253,0.15)',
              color: '#388bfd',
              border: '1px solid rgba(56,139,253,0.3)',
            }}>
              Tutor active
            </span>
          )}
        </div>
        <button
          onClick={() => dispatch({ type: 'RESET', seed_set: seedSet })}
          style={{
            fontSize: '12px',
            color: '#8b949e',
            background: 'transparent',
            border: '1px solid #30363d',
            borderRadius: '6px',
            padding: '4px 12px',
            cursor: 'pointer',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.borderColor = '#484f58'
            el.style.color = '#c9d1d9'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.borderColor = '#30363d'
            el.style.color = '#8b949e'
          }}
        >
          Reset
        </button>
      </header>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {state.view === 'inbox' || !selectedInvoice ? (
          <div>
            <div style={{
              padding: '10px 20px',
              borderBottom: '1px solid #21262d',
              fontSize: '13px',
              fontWeight: 600,
              color: '#8b949e',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: '#161b22',
            }}>
              Invoice Inbox
            </div>
            <InvoiceInbox invoices={state.invoices} dispatch={dispatch} />
          </div>
        ) : (
          <InvoiceDetail
            key={selectedInvoice.id}
            invoice={selectedInvoice}
            dispatch={dispatch}
            pendingAction={pendingAction}
          />
        )}
      </div>

      <footer style={{
        borderTop: '1px solid #21262d',
        padding: '5px 20px',
        fontSize: '11px',
        color: '#484f58',
        background: '#161b22',
      }}>
        Sandbox data · No real invoices
      </footer>
    </div>
  )
}

export default function ErpPage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px', color: '#8b949e', background: '#0d1117', minHeight: '100dvh' }}>Loading…</div>}>
      <ErpApp />
    </Suspense>
  )
}
