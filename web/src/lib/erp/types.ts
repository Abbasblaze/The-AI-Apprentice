import type { CheckVerdict, EventKind } from '@/lib/types'

export type SeedSet = 'expert' | 'newhire'
export type InvoiceStatus = 'open' | 'held' | 'awaiting-approval' | 'posted'
export type CostCenter = 'opex 4711' | 'capex 0400'

export interface Invoice {
  id: string
  number: string
  supplier: string
  country: string
  amount: number
  description: string
  due_date: string
  cost_center: CostCenter
  asset_number: string
  status: InvoiceStatus
  internal_note: string
  contact_name: string
  contact_email: string
  contact_phone: string
  bank_iban: string
}

export interface ErpState {
  seedSet: SeedSet
  invoices: Invoice[]
  view: 'inbox' | 'detail'
  selected_invoice_id: string | null
}

export type ErpAction =
  | { type: 'SELECT_INVOICE'; invoice_id: string }
  | { type: 'BACK_TO_INBOX' }
  | { type: 'CHANGE_COST_CENTER'; invoice_id: string; value: CostCenter }
  | { type: 'SET_ASSET_NUMBER'; invoice_id: string; value: string }
  | { type: 'SET_INTERNAL_NOTE'; invoice_id: string; value: string }
  | { type: 'HOLD'; invoice_id: string }
  | { type: 'RELEASE_HOLD'; invoice_id: string }
  | { type: 'SEND_FOR_APPROVAL'; invoice_id: string }
  | { type: 'POST'; invoice_id: string }
  | { type: 'RESET'; seed_set: SeedSet }

export interface ErpBroadcastEvent {
  wallMs: number
  kind: EventKind
  subject: string
  field: string | null
  from_value: string | null
  to_value: string | null
  summary: string
}

export type ErpBroadcastMessage =
  | { type: 'erp-events'; events: ErpBroadcastEvent[] }
  | { type: 'tutor-block'; verdict: CheckVerdict }

export type { CheckVerdict }
