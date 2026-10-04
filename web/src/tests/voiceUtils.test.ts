import { describe, expect, it } from 'vitest'

import {
  BAR_COUNT,
  MIC_LEVEL_THRESHOLD,
  PENDING_ANSWER_TIMEOUT_MS,
  UNHEARD_WARN_THRESHOLD_MS,
  calcFilledBars,
  detectVoiceCommand,
  isUnheardSpeech,
  shouldWarnNoTranscript,
} from '@/lib/voiceUtils'

describe('constants', () => {
  it('BAR_COUNT is 20', () => expect(BAR_COUNT).toBe(20))
  it('PENDING_ANSWER_TIMEOUT_MS is 45 000', () => expect(PENDING_ANSWER_TIMEOUT_MS).toBe(45_000))
  it('UNHEARD_WARN_THRESHOLD_MS is 5 000', () => expect(UNHEARD_WARN_THRESHOLD_MS).toBe(5_000))
  it('MIC_LEVEL_THRESHOLD is 0.05', () => expect(MIC_LEVEL_THRESHOLD).toBe(0.05))
})

describe('calcFilledBars', () => {
  it('returns 0 for level 0', () => expect(calcFilledBars(0, 20)).toBe(0))
  it('returns count for level 1', () => expect(calcFilledBars(1, 20)).toBe(20))
  it('returns half for level 0.5', () => expect(calcFilledBars(0.5, 20)).toBe(10))
  it('clamps below 0 to 0', () => expect(calcFilledBars(-1, 20)).toBe(0))
  it('clamps above 1 to count', () => expect(calcFilledBars(2, 20)).toBe(20))
  it('rounds 0.74 to 15 with count 20', () => expect(calcFilledBars(0.74, 20)).toBe(15))
  it('works with count of 1', () => expect(calcFilledBars(0.6, 1)).toBe(1))
  it('works with count of 0', () => expect(calcFilledBars(0.9, 0)).toBe(0))
})

describe('detectVoiceCommand', () => {
  it('detects off-record', () => expect(detectVoiceCommand('go off the record')).toBe('off-record'))
  it('detects on-record', () => expect(detectVoiceCommand("let's go back on the record")).toBe('on-record'))
  it('detects forget', () => expect(detectVoiceCommand('forget that please')).toBe('forget'))
  it('returns null for unrelated text', () => expect(detectVoiceCommand('approve the invoice')).toBeNull())
  it('is case-insensitive for off-record', () => expect(detectVoiceCommand('OFF THE RECORD')).toBe('off-record'))
  it('is case-insensitive for forget', () => expect(detectVoiceCommand('FORGET THAT')).toBe('forget'))
  it('returns null for empty string', () => expect(detectVoiceCommand('')).toBeNull())
})

describe('isUnheardSpeech', () => {
  const NOW = 10_000

  it('returns false when not connected', () => {
    expect(isUnheardSpeech(false, NOW - 500, 0, NOW)).toBe(false)
  })

  it('returns false when lastUserSpeechMs is 0', () => {
    expect(isUnheardSpeech(true, 0, 0, NOW)).toBe(false)
  })

  it('returns false when speech is older than 3 s', () => {
    expect(isUnheardSpeech(true, NOW - 3_001, 0, NOW)).toBe(false)
  })

  it('returns false when transcript arrived recently', () => {
    expect(isUnheardSpeech(true, NOW - 500, NOW - 100, NOW)).toBe(false)
  })

  it('returns true when connected, speaking recently, but transcript is stale by threshold', () => {
    const speechAt = NOW - 500
    const transcriptAt = NOW - UNHEARD_WARN_THRESHOLD_MS - 1
    expect(isUnheardSpeech(true, speechAt, transcriptAt, NOW)).toBe(true)
  })

  it('returns false when transcript lag is exactly at threshold (not over)', () => {
    const speechAt = NOW - 500
    const transcriptAt = NOW - UNHEARD_WARN_THRESHOLD_MS
    expect(isUnheardSpeech(true, speechAt, transcriptAt, NOW)).toBe(false)
  })

  it('returns true when transcript is zero and speech is recent', () => {
    expect(isUnheardSpeech(true, NOW - 1_000, 0, NOW)).toBe(true)
  })
})

describe('calcFilledBars — level meter', () => {
  it('maps level 0 to 0 bars', () => expect(calcFilledBars(0, BAR_COUNT)).toBe(0))
  it('maps level 1 to BAR_COUNT bars', () => expect(calcFilledBars(1, BAR_COUNT)).toBe(BAR_COUNT))
  it('maps level just above threshold to at least 1 bar', () =>
    expect(calcFilledBars(MIC_LEVEL_THRESHOLD + 0.001, BAR_COUNT)).toBeGreaterThan(0))
  it('maps level at threshold to 0 bars (threshold is exclusive lower bound)', () =>
    expect(calcFilledBars(MIC_LEVEL_THRESHOLD, BAR_COUNT)).toBe(1))
})

describe('shouldWarnNoTranscript', () => {
  const NOW = 20_000

  it('returns false when not connected', () => {
    expect(shouldWarnNoTranscript(false, NOW - 6_000, 0, NOW)).toBe(false)
  })

  it('returns false when micActiveMs is 0 (no speech detected)', () => {
    expect(shouldWarnNoTranscript(true, 0, 0, NOW)).toBe(false)
  })

  it('returns false when mic has been active less than threshold', () => {
    expect(shouldWarnNoTranscript(true, NOW - 4_000, 0, NOW)).toBe(false)
  })

  it('returns false when transcript arrived after mic became active', () => {
    const micActiveMs = NOW - 6_000
    const lastTranscriptMs = NOW - 2_000
    expect(shouldWarnNoTranscript(true, micActiveMs, lastTranscriptMs, NOW)).toBe(false)
  })

  it('returns true when connected, mic active 5+ seconds, transcript predates mic activity', () => {
    const micActiveMs = NOW - 6_000
    const lastTranscriptMs = NOW - 8_000
    expect(shouldWarnNoTranscript(true, micActiveMs, lastTranscriptMs, NOW)).toBe(true)
  })

  it('returns true when connected, mic active 5+ seconds, and transcript is 0', () => {
    expect(shouldWarnNoTranscript(true, NOW - 6_000, 0, NOW)).toBe(true)
  })

  it('returns false when mic active exactly at threshold (not over)', () => {
    expect(shouldWarnNoTranscript(true, NOW - UNHEARD_WARN_THRESHOLD_MS, 0, NOW)).toBe(false)
  })
})
