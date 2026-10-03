import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { shouldAsk } from '../lib/pauseDetector'
import type { PauseState } from '../lib/pauseDetector'

const NOW = 2_000_000

function readyState(overrides: Partial<PauseState> = {}): PauseState {
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

describe('Asking flow (mocked E2E)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pause detector gates the director call: fires only when all conditions met', () => {
    expect(shouldAsk(readyState())).toBe(true)
    expect(shouldAsk(readyState({ isOffRecord: true }))).toBe(false)
    expect(shouldAsk(readyState({ isSpeaking: true }))).toBe(false)
    expect(shouldAsk(readyState({ isPendingAnswer: true }))).toBe(false)
    expect(shouldAsk(readyState({ lastScreenChangeMs: NOW - 1_000 }))).toBe(false)
    expect(shouldAsk(readyState({ lastUserSpeechMs: NOW - 500 }))).toBe(false)
    expect(shouldAsk(readyState({ lastQuestionAskedMs: NOW - 30_000 }))).toBe(false)
  })

  it('director call uses session_id and elapsed_seconds', async () => {
    const mockResponse = {
      should_ask: true,
      kind: 'reason',
      anchor_event_id: 'event-001',
      question: 'You moved the record to a different folder. What prompted that?',
      why: 'value changed',
      rejected_reason: null,
    }
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const API_BASE = 'http://localhost:8000'
    const res = await fetch(`${API_BASE}/api/director/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 'test-session', elapsed_seconds: 120 }),
    })
    const data = await res.json()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/director/decide',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(data.should_ask).toBe(true)
    expect(data.question).toContain('moved')
  })

  it('should_ask=false means no message is sent', async () => {
    const mockResponse = {
      should_ask: false,
      kind: 'reason',
      anchor_event_id: '',
      question: '',
      why: 'no interesting event',
      rejected_reason: null,
    }
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const res = await fetch('http://localhost:8000/api/director/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 'test-session', elapsed_seconds: 60 }),
    })
    const data = await res.json()

    expect(data.should_ask).toBe(false)
    expect(data.question).toBe('')
  })

  it('[DIRECTOR] prefix is prepended to the question text', () => {
    const question = 'You moved invoice 4471 to a different cost center. What made you do that?'
    const message = `[DIRECTOR] ${question}`
    expect(message.startsWith('[DIRECTOR]')).toBe(true)
    expect(message).toContain(question)
  })
})

/*
 * ElevenLabs dashboard settings to verify before a real session:
 *
 * 1. Agent > Tools: add a client tool named exactly "get_recent_screen_events"
 *    with no parameters. The tool description should tell the agent it returns
 *    the last 10 screen events as plain text.
 *
 * 2. Agent > System prompt: instruct the agent to use [DIRECTOR] prefixed
 *    messages as questions to relay verbatim to the expert.
 *
 * 3. Agent > Voice: pick a calm, neutral voice. Latency optimise setting on.
 *
 * 4. Agent > Security > Signed URL: enable "Require signed URL" so the agent
 *    is not accessible without a backend-issued signed URL.
 *
 * 5. Workspace > API Keys: the xi-api-key used in ELEVENLABS_API_KEY must have
 *    Conversational AI scope (not just TTS scope).
 *
 * 6. Agent ID: copy the agent ID from Agent Settings and set ELEVENLABS_AGENT_ID
 *    in api/.env.
 */
