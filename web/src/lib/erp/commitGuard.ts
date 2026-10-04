import type { CheckVerdict } from '@/lib/types'
import type { ErpAction, Invoice } from './types'

export type CommitDecision = 'allow' | 'deny'

export interface CommitGuardResult {
  decision: CommitDecision
  reason?: string
}

export type CommitGuard = (action: ErpAction, invoice: Invoice | null) => CommitGuardResult

export type AsyncCommitGuard = (
  action: ErpAction,
  invoice: Invoice | null,
) => Promise<{ decision: CommitDecision; verdict?: CheckVerdict }>

export const defaultCommitGuard: CommitGuard = () => ({ decision: 'allow' })
