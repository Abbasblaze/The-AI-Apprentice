import { describe, expect, it } from 'vitest'

import { defaultCommitGuard } from '@/lib/erp/commitGuard'
import { SEEDS } from '@/lib/erp/seeds'
import type { Invoice } from '@/lib/erp/types'

const sampleInvoice: Invoice = SEEDS['expert'].invoices[0]

describe('defaultCommitGuard', () => {
  it('allows CHANGE_COST_CENTER', () => {
    const result = defaultCommitGuard(
      { type: 'CHANGE_COST_CENTER', invoice_id: sampleInvoice.id, value: 'capex 0400' },
      sampleInvoice,
    )
    expect(result.decision).toBe('allow')
  })

  it('allows POST', () => {
    const result = defaultCommitGuard(
      { type: 'POST', invoice_id: sampleInvoice.id },
      sampleInvoice,
    )
    expect(result.decision).toBe('allow')
  })

  it('allows HOLD', () => {
    const result = defaultCommitGuard(
      { type: 'HOLD', invoice_id: sampleInvoice.id },
      sampleInvoice,
    )
    expect(result.decision).toBe('allow')
  })

  it('allows navigation actions with null invoice', () => {
    const result = defaultCommitGuard({ type: 'BACK_TO_INBOX' }, null)
    expect(result.decision).toBe('allow')
  })

  it('allows RESET', () => {
    const result = defaultCommitGuard({ type: 'RESET', seed_set: 'expert' }, null)
    expect(result.decision).toBe('allow')
  })
})
