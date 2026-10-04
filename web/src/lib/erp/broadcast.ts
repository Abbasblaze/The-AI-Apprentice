import type { CheckVerdict, ErpBroadcastEvent, ErpBroadcastMessage } from './types'

export const ERP_CHANNEL = 'ai-apprentice-erp'

export function broadcastErpEvents(events: ErpBroadcastEvent[]): void {
  if (typeof window === 'undefined' || events.length === 0) return
  try {
    const channel = new BroadcastChannel(ERP_CHANNEL)
    const msg: ErpBroadcastMessage = { type: 'erp-events', events }
    channel.postMessage(msg)
    channel.close()
  } catch {
    // BroadcastChannel unavailable (e.g. cross-origin iframe)
  }
}

export function broadcastTutorBlock(verdict: CheckVerdict): void {
  if (typeof window === 'undefined') return
  try {
    const channel = new BroadcastChannel(ERP_CHANNEL)
    const msg: ErpBroadcastMessage = { type: 'tutor-block', verdict }
    channel.postMessage(msg)
    channel.close()
  } catch {
    // BroadcastChannel unavailable
  }
}
