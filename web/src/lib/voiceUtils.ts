export const BAR_COUNT = 20
export const PENDING_ANSWER_TIMEOUT_MS = 45_000
export const UNHEARD_WARN_THRESHOLD_MS = 5_000
export const MIC_LEVEL_THRESHOLD = 0.05

export function calcFilledBars(level: number, count: number): number {
  return Math.round(Math.max(0, Math.min(1, level)) * count)
}

export function detectVoiceCommand(
  text: string,
): 'off-record' | 'on-record' | 'forget' | null {
  const lower = text.toLowerCase()
  if (lower.includes('back on the record')) return 'on-record'
  if (lower.includes('off the record')) return 'off-record'
  if (lower.includes('forget that')) return 'forget'
  return null
}

export function isUnheardSpeech(
  isConnected: boolean,
  lastUserSpeechMs: number,
  lastUserTranscriptMs: number,
  nowMs: number,
): boolean {
  if (!isConnected) return false
  if (lastUserSpeechMs === 0) return false
  if (nowMs - lastUserSpeechMs > 3_000) return false
  return nowMs - lastUserTranscriptMs > UNHEARD_WARN_THRESHOLD_MS
}

export function shouldWarnNoTranscript(
  isConnected: boolean,
  micActiveMs: number,
  lastTranscriptMs: number,
  nowMs: number,
): boolean {
  if (!isConnected || micActiveMs === 0) return false
  if (nowMs - micActiveMs <= UNHEARD_WARN_THRESHOLD_MS) return false
  return lastTranscriptMs < micActiveMs
}
