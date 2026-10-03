import type { CostCenter, ErpAction, ErpState, Invoice } from './types'
import type { ErpBroadcastEvent } from './types'
import { SEEDS } from './seeds'

function updateInvoice(
  invoices: Invoice[],
  invoice_id: string,
  updater: (inv: Invoice) => Invoice,
): Invoice[] {
  return invoices.map((inv) => (inv.id === invoice_id ? updater(inv) : inv))
}

export function erpReducer(state: ErpState, action: ErpAction): ErpState {
  switch (action.type) {
    case 'SELECT_INVOICE':
      return { ...state, view: 'detail', selected_invoice_id: action.invoice_id }

    case 'BACK_TO_INBOX':
      return { ...state, view: 'inbox', selected_invoice_id: null }

    case 'CHANGE_COST_CENTER':
      return {
        ...state,
        invoices: updateInvoice(state.invoices, action.invoice_id, (inv) => ({
          ...inv,
          cost_center: action.value,
        })),
      }

    case 'SET_ASSET_NUMBER':
      return {
        ...state,
        invoices: updateInvoice(state.invoices, action.invoice_id, (inv) => ({
          ...inv,
          asset_number: action.value,
        })),
      }

    case 'SET_INTERNAL_NOTE':
      return {
        ...state,
        invoices: updateInvoice(state.invoices, action.invoice_id, (inv) => ({
          ...inv,
          internal_note: action.value,
        })),
      }

    case 'HOLD':
      return {
        ...state,
        invoices: updateInvoice(state.invoices, action.invoice_id, (inv) => ({
          ...inv,
          status: 'held',
        })),
      }

    case 'RELEASE_HOLD':
      return {
        ...state,
        invoices: updateInvoice(state.invoices, action.invoice_id, (inv) => ({
          ...inv,
          status: 'open',
        })),
      }

    case 'SEND_FOR_APPROVAL':
      return {
        ...state,
        invoices: updateInvoice(state.invoices, action.invoice_id, (inv) => ({
          ...inv,
          status: 'awaiting-approval',
        })),
      }

    case 'POST':
      return {
        ...state,
        invoices: updateInvoice(state.invoices, action.invoice_id, (inv) => ({
          ...inv,
          status: 'posted',
        })),
      }

    case 'RESET':
      return { ...(SEEDS[action.seed_set] ?? SEEDS['expert']), seedSet: action.seed_set }

    default:
      return state
  }
}

export function toErpEvents(action: ErpAction, state: ErpState): ErpBroadcastEvent[] {
  if (
    action.type === 'SELECT_INVOICE' ||
    action.type === 'BACK_TO_INBOX' ||
    action.type === 'RESET'
  ) {
    return []
  }

  const invoice = state.invoices.find((inv) => inv.id === action.invoice_id)
  if (!invoice) return []

  const wallMs = Date.now()
  const subject = `invoice ${invoice.number}`

  switch (action.type) {
    case 'CHANGE_COST_CENTER':
      return [
        {
          wallMs,
          kind: 'changed',
          subject,
          field: 'cost center',
          from_value: invoice.cost_center as CostCenter,
          to_value: action.value,
          summary: `Cost center changed from ${invoice.cost_center} to ${action.value} on ${subject}`,
        },
      ]

    case 'SET_ASSET_NUMBER':
      return [
        {
          wallMs,
          kind: 'typed',
          subject,
          field: 'asset number',
          from_value: invoice.asset_number || null,
          to_value: action.value || null,
          summary: `Asset number set to "${action.value}" on ${subject}`,
        },
      ]

    case 'SET_INTERNAL_NOTE':
      return [
        {
          wallMs,
          kind: 'typed',
          subject,
          field: 'internal note',
          from_value: invoice.internal_note || null,
          to_value: action.value || null,
          summary: `Internal note updated on ${subject}`,
        },
      ]

    case 'HOLD':
      return [
        {
          wallMs,
          kind: 'changed',
          subject,
          field: 'status',
          from_value: invoice.status,
          to_value: 'held',
          summary: `${subject} placed on hold`,
        },
      ]

    case 'RELEASE_HOLD':
      return [
        {
          wallMs,
          kind: 'changed',
          subject,
          field: 'status',
          from_value: invoice.status,
          to_value: 'open',
          summary: `Hold released on ${subject}`,
        },
      ]

    case 'SEND_FOR_APPROVAL':
      return [
        {
          wallMs,
          kind: 'changed',
          subject,
          field: 'status',
          from_value: invoice.status,
          to_value: 'awaiting-approval',
          summary: `${subject} sent for second approval`,
        },
      ]

    case 'POST':
      return [
        {
          wallMs,
          kind: 'changed',
          subject,
          field: 'status',
          from_value: invoice.status,
          to_value: 'posted',
          summary: `${subject} posted`,
        },
      ]

    default:
      return []
  }
}
