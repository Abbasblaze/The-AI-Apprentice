import { describe, expect, it } from 'vitest'

import { DEFAULT_PAUSE_CONFIG, shouldAsk } from '../lib/pauseDetector'
import type { PauseState } from '../lib/pauseDetector'

const NOW = 1_000_000

function baseState(overrides: Partial<PauseState> = {}): PauseState {
  return {
    lastScreenChangeMs: NOW - 10_000,
    lastUserSpeechMs: NOW - 10_000,
    isSpeaking: false,
    isPendingAnswer: false,
    lastQuestionAskedMs: 0,
    isOffRecord: false,
    nowMs: NOW,
    ...overrides,
  }
}

describe('shouldAsk', () => {
  it('returns true when all conditions are met', () => {
    expect(shouldAsk(baseState())).toBe(true)
  })

  it('returns false when off the record', () => {
    expect(shouldAsk(baseState({ isOffRecord: true }))).toBe(false)
  })

  it('returns false when agent is speaking', () => {
    expect(shouldAsk(baseState({ isSpeaking: true }))).toBe(false)
  })

  it('returns false when answer is pending', () => {
    expect(shouldAsk(baseState({ isPendingAnswer: true }))).toBe(false)
  })

  it('returns false when screen changed too recently', () => {
    expect(
      shouldAsk(baseState({ lastScreenChangeMs: NOW - 2_000 })),
    ).toBe(false)
  })

  it('returns true when screen change just crossed the threshold', () => {
    expect(
      shouldAsk(baseState({ lastScreenChangeMs: NOW - DEFAULT_PAUSE_CONFIG.screenQuietMs })),
    ).toBe(true)
  })

  it('returns false when user spoke too recently', () => {
    expect(
      shouldAsk(baseState({ lastUserSpeechMs: NOW - 1_000 })),
    ).toBe(false)
  })

  it('returns true when user speech just crossed the threshold', () => {
    expect(
      shouldAsk(baseState({ lastUserSpeechMs: NOW - DEFAULT_PAUSE_CONFIG.speechQuietMs })),
    ).toBe(true)
  })

  it('returns false when last question was asked too recently', () => {
    expect(
      shouldAsk(
        baseState({
          lastQuestionAskedMs: NOW - 60_000,
        }),
      ),
    ).toBe(false)
  })

  it('returns true when question interval has elapsed', () => {
    expect(
      shouldAsk(
        baseState({
          lastQuestionAskedMs: NOW - DEFAULT_PAUSE_CONFIG.minQuestionIntervalMs,
        }),
      ),
    ).toBe(true)
  })

  it('returns true when lastQuestionAskedMs is 0 (no question yet)', () => {
    expect(shouldAsk(baseState({ lastQuestionAskedMs: 0 }))).toBe(true)
  })

  it('uses custom config thresholds', () => {
    const state = baseState({ lastScreenChangeMs: NOW - 3_000 })
    expect(shouldAsk(state, { ...DEFAULT_PAUSE_CONFIG, screenQuietMs: 5_000 })).toBe(false)
    expect(shouldAsk(state, { ...DEFAULT_PAUSE_CONFIG, screenQuietMs: 2_000 })).toBe(true)
  })

  it('returns false when multiple conditions fail simultaneously', () => {
    expect(
      shouldAsk(
        baseState({
          isOffRecord: true,
          isSpeaking: true,
          isPendingAnswer: true,
        }),
      ),
    ).toBe(false)
  })
})
