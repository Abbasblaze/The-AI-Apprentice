import { describe, expect, it } from 'vitest'

import { erpReducer, toErpEvents } from '@/lib/erp/reducer'
import { SEEDS } from '@/lib/erp/seeds'
import type { ErpState } from '@/lib/erp/types'

function freshState(): ErpState {
  return JSON.parse(JSON.stringify(SEEDS['expert'])) as ErpState
}

describe('erpReducer', () => {
  it('SELECT_INVOICE navigates to detail view', () => {
    const state = freshState()
    const next = erpReducer(state, { type: 'SELECT_INVOICE', invoice_id: 'inv-4471' })
    expect(next.view).toBe('detail')
    expect(next.selected_invoice_id).toBe('inv-4471')
  })

  it('BACK_TO_INBOX returns to inbox', () => {
    const state = { ...freshState(), view: 'detail' as const, selected_invoice_id: 'inv-4471' }
    const next = erpReducer(state, { type: 'BACK_TO_INBOX' })
    expect(next.view).toBe('inbox')
    expect(next.selected_invoice_id).toBeNull()
  })

  it('CHANGE_COST_CENTER updates the correct invoice', () => {
    const state = freshState()
    const next = erpReducer(state, {
      type: 'CHANGE_COST_CENTER',
      invoice_id: 'inv-4471',
      value: 'capex 0400',
    })
    const inv = next.invoices.find((i) => i.id === 'inv-4471')!
    expect(inv.cost_center).toBe('capex 0400')
    // other invoices unchanged
    const other = next.invoices.find((i) => i.id === 'inv-4472')!
    expect(other.cost_center).toBe('opex 4711')
  })

  it('HOLD sets status to held', () => {
    const state = freshState()
    const next = erpReducer(state, { type: 'HOLD', invoice_id: 'inv-4471' })
    expect(next.invoices.find((i) => i.id === 'inv-4471')!.status).toBe('held')
  })

  it('RELEASE_HOLD sets status back to open', () => {
    const state = freshState()
    const held = erpReducer(state, { type: 'HOLD', invoice_id: 'inv-4471' })
    const released = erpReducer(held, { type: 'RELEASE_HOLD', invoice_id: 'inv-4471' })
    expect(released.invoices.find((i) => i.id === 'inv-4471')!.status).toBe('open')
  })

  it('SEND_FOR_APPROVAL sets awaiting-approval', () => {
    const state = freshState()
    const next = erpReducer(state, { type: 'SEND_FOR_APPROVAL', invoice_id: 'inv-4472' })
    expect(next.invoices.find((i) => i.id === 'inv-4472')!.status).toBe('awaiting-approval')
  })

  it('POST sets status to posted', () => {
    const state = freshState()
    const next = erpReducer(state, { type: 'POST', invoice_id: 'inv-4473' })
    expect(next.invoices.find((i) => i.id === 'inv-4473')!.status).toBe('posted')
  })

  it('SET_ASSET_NUMBER updates asset number', () => {
    const state = freshState()
    const next = erpReducer(state, {
      type: 'SET_ASSET_NUMBER',
      invoice_id: 'inv-4471',
      value: 'AST-9901',
    })
    expect(next.invoices.find((i) => i.id === 'inv-4471')!.asset_number).toBe('AST-9901')
  })

  it('RESET restores seed state', () => {
    const state = freshState()
    const modified = erpReducer(state, { type: 'POST', invoice_id: 'inv-4471' })
    const reset = erpReducer(modified, { type: 'RESET', seed_set: 'expert' })
    expect(reset.invoices.find((i) => i.id === 'inv-4471')!.status).toBe('open')
  })

  it('is immutable — original state unchanged', () => {
    const state = freshState()
    const original = JSON.stringify(state)
    erpReducer(state, { type: 'HOLD', invoice_id: 'inv-4471' })
    expect(JSON.stringify(state)).toBe(original)
  })
})

describe('toErpEvents', () => {
  it('CHANGE_COST_CENTER produces changed event', () => {
    const state = freshState()
    const events = toErpEvents(
      { type: 'CHANGE_COST_CENTER', invoice_id: 'inv-4471', value: 'capex 0400' },
      state,
    )
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('changed')
    expect(events[0].field).toBe('cost center')
    expect(events[0].from_value).toBe('opex 4711')
    expect(events[0].to_value).toBe('capex 0400')
  })

  it('SELECT_INVOICE produces no events', () => {
    const state = freshState()
    const events = toErpEvents({ type: 'SELECT_INVOICE', invoice_id: 'inv-4471' }, state)
    expect(events).toHaveLength(0)
  })

  it('POST produces status changed event', () => {
    const state = freshState()
    const events = toErpEvents({ type: 'POST', invoice_id: 'inv-4471' }, state)
    expect(events[0].to_value).toBe('posted')
    expect(events[0].field).toBe('status')
  })

  it('events have wallMs timestamp', () => {
    const state = freshState()
    const before = Date.now()
    const events = toErpEvents({ type: 'HOLD', invoice_id: 'inv-4471' }, state)
    const after = Date.now()
    expect(events[0].wallMs).toBeGreaterThanOrEqual(before)
    expect(events[0].wallMs).toBeLessThanOrEqual(after)
  })
})
