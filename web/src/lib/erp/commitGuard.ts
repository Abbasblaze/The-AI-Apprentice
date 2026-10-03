import type { Invoice } from './types'
import type { ErpAction } from './types'

export type CommitDecision = 'allow' | 'deny'

export interface CommitGuardResult {
  decision: CommitDecision
  reason?: string
}

export type CommitGuard = (action: ErpAction, invoice: Invoice | null) => CommitGuardResult

export const defaultCommitGuard: CommitGuard = () => ({ decision: 'allow' })
