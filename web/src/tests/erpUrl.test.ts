import { describe, it, expect } from 'vitest'
import { expertErpUrl, learnerErpUrl } from '@/lib/erpUrl'

describe('expertErpUrl', () => {
  it('returns expert ERP URL', () => {
    expect(expertErpUrl()).toBe('/erp?set=expert')
  })
})

describe('learnerErpUrl', () => {
  it('returns base learner URL without tutor session', () => {
    expect(learnerErpUrl()).toBe('/erp?set=newhire')
  })

  it('returns learner URL with tutor session id', () => {
    expect(learnerErpUrl('abc-123')).toBe('/erp?set=newhire&tutor=abc-123')
  })

  it('returns base URL when tutor session id is undefined', () => {
    expect(learnerErpUrl(undefined)).toBe('/erp?set=newhire')
  })
})
