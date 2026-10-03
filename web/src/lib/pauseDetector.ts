export interface PauseConfig {
  screenQuietMs: number
  speechQuietMs: number
  minQuestionIntervalMs: number
}

export const DEFAULT_PAUSE_CONFIG: PauseConfig = {
  screenQuietMs: 2500,
  speechQuietMs: 2500,
  minQuestionIntervalMs: 90_000,
}

export interface PauseState {
  lastScreenChangeMs: number
  lastUserSpeechMs: number
  isSpeaking: boolean
  isPendingAnswer: boolean
  lastQuestionAskedMs: number
  isOffRecord: boolean
  nowMs: number
}

export function shouldAsk(
  state: PauseState,
  config: PauseConfig = DEFAULT_PAUSE_CONFIG,
): boolean {
  const {
    lastScreenChangeMs,
    lastUserSpeechMs,
    isSpeaking,
    isPendingAnswer,
    lastQuestionAskedMs,
    isOffRecord,
    nowMs,
  } = state

  if (isOffRecord) return false
  if (isSpeaking) return false
  if (isPendingAnswer) return false
  if (nowMs - lastScreenChangeMs < config.screenQuietMs) return false
  if (nowMs - lastUserSpeechMs < config.speechQuietMs) return false
  if (lastQuestionAskedMs > 0 && nowMs - lastQuestionAskedMs < config.minQuestionIntervalMs)
    return false

  return true
}
