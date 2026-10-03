'use client'

import { useCallback, useEffect, useRef } from 'react'

import { postDirectorDecide } from '@/lib/apiClient'
import { shouldAsk } from '@/lib/pauseDetector'
import type { QuestionEntry, QuestionKind } from '@/lib/types'

const DIRECTOR_POLL_MS = 1000
const MIN_DIRECTOR_INTERVAL_MS = 5000

interface DirectorLoopOptions {
  sessionIdRef: React.RefObject<string>
  startTimeRef: React.RefObject<number>
  enabled: boolean
  isOffRecord: boolean
  isSpeaking: boolean
  isPendingAnswer: boolean
  lastScreenChangeMs: number
  lastUserSpeechMs: number
  lastQuestionAskedMs: number
  onQuestion: (entry: QuestionEntry) => void
  sendDirectorQuestion: (questionId: string, question: string) => void
}

export function useDirectorLoop({
  sessionIdRef,
  startTimeRef,
  enabled,
  isOffRecord,
  isSpeaking,
  isPendingAnswer,
  lastScreenChangeMs,
  lastUserSpeechMs,
  lastQuestionAskedMs,
  onQuestion,
  sendDirectorQuestion,
}: DirectorLoopOptions): void {
  const lastDirectorCallMsRef = useRef(0)
  const inFlightRef = useRef(false)

  const stateRef = useRef({
    isOffRecord,
    isSpeaking,
    isPendingAnswer,
    lastScreenChangeMs,
    lastUserSpeechMs,
    lastQuestionAskedMs,
    onQuestion,
    sendDirectorQuestion,
  })

  useEffect(() => {
    stateRef.current = {
      isOffRecord,
      isSpeaking,
      isPendingAnswer,
      lastScreenChangeMs,
      lastUserSpeechMs,
      lastQuestionAskedMs,
      onQuestion,
      sendDirectorQuestion,
    }
  })

  const tryAsk = useCallback(async () => {
    if (inFlightRef.current) return
    const now = Date.now()
    if (now - lastDirectorCallMsRef.current < MIN_DIRECTOR_INTERVAL_MS) return

    const s = stateRef.current
    const canAsk = shouldAsk({
      lastScreenChangeMs: s.lastScreenChangeMs,
      lastUserSpeechMs: s.lastUserSpeechMs,
      isSpeaking: s.isSpeaking,
      isPendingAnswer: s.isPendingAnswer,
      lastQuestionAskedMs: s.lastQuestionAskedMs,
      isOffRecord: s.isOffRecord,
      nowMs: now,
    })
    if (!canAsk) return

    inFlightRef.current = true
    lastDirectorCallMsRef.current = now

    try {
      const elapsed = (now - startTimeRef.current) / 1000
      const result = await postDirectorDecide({
        session_id: sessionIdRef.current,
        elapsed_seconds: elapsed,
      })

      if (!result.should_ask) return

      const entry: QuestionEntry = {
        id: crypto.randomUUID(),
        t: elapsed,
        kind: result.kind as QuestionKind,
        text: result.question,
        anchorEventId: result.anchor_event_id,
        answered: false,
        answerText: null,
      }

      s.onQuestion(entry)
      s.sendDirectorQuestion(entry.id, result.question)
    } catch {
    } finally {
      inFlightRef.current = false
    }
  }, [sessionIdRef, startTimeRef])

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(tryAsk, DIRECTOR_POLL_MS)
    return () => clearInterval(id)
  }, [enabled, tryAsk])
}
