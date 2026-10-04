'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useConversation } from '@elevenlabs/react'

import { fetchSignedUrl, postTranscriptEntries } from '@/lib/apiClient'
import type { AppEvent, TranscriptEntry, VoiceMode } from '@/lib/types'

const CONTEXT_BATCH_MS = 2000
const TRANSCRIPT_FLUSH_MIN = 3
const ANSWER_SILENCE_MS = 2000

interface UseVoiceSessionOptions {
  sessionIdRef: React.RefObject<string>
  startTimeRef: React.RefObject<number>
  onError: (msg: string) => void
  onAnswered: (questionId: string, answerText: string) => void
  onOffRecordChange: (offRecord: boolean, t: number) => void
  onForgetThat: () => void
}

interface UseVoiceSessionResult {
  isConnected: boolean
  voiceMode: VoiceMode
  isOffRecord: boolean
  isPendingAnswer: boolean
  lastUserSpeechMs: number
  startVoice: () => Promise<void>
  stopVoice: () => void
  pushScreenEvents: (events: AppEvent[]) => void
  sendDirectorQuestion: (questionId: string, question: string) => void
  toggleOffRecord: () => void
  confirmForget: () => void
}

export function useVoiceSession({
  sessionIdRef,
  startTimeRef,
  onError,
  onAnswered,
  onOffRecordChange,
  onForgetThat,
}: UseVoiceSessionOptions): UseVoiceSessionResult {
  const [isConnected, setIsConnected] = useState(false)
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('idle')
  const [isOffRecord, setIsOffRecord] = useState(false)
  const [isPendingAnswer, setIsPendingAnswer] = useState(false)
  const [lastUserSpeechMs, setLastUserSpeechMs] = useState(0)

  const pendingRef = useRef<{ questionId: string; text: string } | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingContextRef = useRef<AppEvent[]>([])
  const contextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptBufferRef = useRef<TranscriptEntry[]>([])
  const isOffRecordRef = useRef(false)
  const isConnectedRef = useRef(false)
  const onAnsweredRef = useRef(onAnswered)
  const onOffRecordChangeRef = useRef(onOffRecordChange)
  const onForgetThatRef = useRef(onForgetThat)

  useEffect(() => {
    onAnsweredRef.current = onAnswered
  }, [onAnswered])

  useEffect(() => {
    onOffRecordChangeRef.current = onOffRecordChange
  }, [onOffRecordChange])

  useEffect(() => {
    onForgetThatRef.current = onForgetThat
  }, [onForgetThat])

  const elapsed = useCallback(
    () => (Date.now() - startTimeRef.current) / 1000,
    [startTimeRef],
  )

  const flushTranscript = useCallback(() => {
    const buffer = transcriptBufferRef.current.splice(0)
    if (buffer.length === 0) return
    postTranscriptEntries(sessionIdRef.current, buffer).catch(() => {})
  }, [sessionIdRef])

  const queueTranscriptEntry = useCallback(
    (entry: TranscriptEntry) => {
      transcriptBufferRef.current.push(entry)
      if (transcriptBufferRef.current.length >= TRANSCRIPT_FLUSH_MIN) {
        flushTranscript()
      }
    },
    [flushTranscript],
  )

  const finishAnswer = useCallback(() => {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    setIsPendingAnswer(false)
    setVoiceMode('listening')
    onAnsweredRef.current(pending.questionId, pending.text)
  }, [])

  const { startSession, endSession, sendContextualUpdate, sendUserMessage } = useConversation({
    onConnect: useCallback(() => {
      isConnectedRef.current = true
      setIsConnected(true)
      setVoiceMode('listening')
    }, []),

    onDisconnect: useCallback(() => {
      isConnectedRef.current = false
      setIsConnected(false)
      setVoiceMode('idle')
      setIsOffRecord(false)
      isOffRecordRef.current = false
      setIsPendingAnswer(false)
      pendingRef.current = null
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      flushTranscript()
    }, [flushTranscript]),

    onError: useCallback(
      (msg: string) => {
        const lower = msg.toLowerCase()
        if (
          lower.includes('microphone') ||
          lower.includes('permission') ||
          lower.includes('notallowed')
        ) {
          onError('Microphone access denied. Please allow microphone access in your browser.')
        } else {
          onError(`Voice error: ${msg}`)
        }
        setVoiceMode('idle')
      },
      [onError],
    ),

    onMessage: useCallback(
      (props: { role: 'user' | 'agent'; message: string }) => {
        if (isOffRecordRef.current) return

        const entry: TranscriptEntry = {
          role: props.role,
          message: props.message,
          t: elapsed(),
        }

        if (props.role === 'user') {
          const lower = props.message.toLowerCase()
          if (lower.includes('off the record')) {
            setIsOffRecord(true)
            isOffRecordRef.current = true
            onOffRecordChangeRef.current(true, elapsed())
            return
          }
          if (lower.includes('back on the record')) {
            setIsOffRecord(false)
            isOffRecordRef.current = false
            onOffRecordChangeRef.current(false, elapsed())
          }
          if (lower.includes('forget that')) {
            onForgetThatRef.current()
            return
          }

          setLastUserSpeechMs(Date.now())

          if (pendingRef.current) {
            const accumulated = pendingRef.current.text
              ? `${pendingRef.current.text} ${props.message}`
              : props.message
            pendingRef.current = { ...pendingRef.current, text: accumulated }

            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = setTimeout(finishAnswer, ANSWER_SILENCE_MS)
          }
        }

        queueTranscriptEntry(entry)
      },
      [elapsed, queueTranscriptEntry, finishAnswer],
    ),

    onModeChange: useCallback((prop: { mode: 'speaking' | 'listening' }) => {
      setVoiceMode((prev) => {
        if (prev === 'waiting' || prev === 'off-record') return prev
        return prop.mode
      })
    }, []),

    onVadScore: useCallback((props: { vadScore: number }) => {
      if (props.vadScore > 0.5) {
        setLastUserSpeechMs(Date.now())
      }
    }, []),
  })

  useEffect(() => {
    if (isOffRecord && isConnectedRef.current) {
      setVoiceMode('off-record')
    } else if (!isOffRecord && isConnectedRef.current) {
      setVoiceMode((prev) => (prev === 'off-record' ? 'listening' : prev))
    }
  }, [isOffRecord])

  const startVoice = useCallback(async () => {
    try {
      const signedUrl = await fetchSignedUrl()
      startSession({ signedUrl })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not start voice session')
    }
  }, [startSession, onError])

  const stopVoice = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (contextTimerRef.current) clearTimeout(contextTimerRef.current)
    flushTranscript()
    endSession()
  }, [endSession, flushTranscript])

  const pushScreenEvents = useCallback(
    (events: AppEvent[]) => {
      if (isOffRecordRef.current || !isConnectedRef.current) return
      pendingContextRef.current.push(...events)

      if (contextTimerRef.current) return
      contextTimerRef.current = setTimeout(() => {
        contextTimerRef.current = null
        const batch = pendingContextRef.current.splice(0)
        if (batch.length === 0) return
        const text = batch
          .map(
            (e) =>
              `[${e.t.toFixed(1)}s] ${e.kind} ${e.subject}` +
              (e.field ? ` · ${e.field}` : '') +
              (e.from_value ? ` ${e.from_value} → ${e.to_value ?? ''}` : ''),
          )
          .join('\n')
        sendContextualUpdate(text)
      }, CONTEXT_BATCH_MS)
    },
    [sendContextualUpdate],
  )

  const sendDirectorQuestion = useCallback(
    (questionId: string, question: string) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      pendingRef.current = { questionId, text: '' }
      setIsPendingAnswer(true)
      setVoiceMode('waiting')
      sendUserMessage(`[DIRECTOR] ${question}`)
    },
    [sendUserMessage],
  )

  const toggleOffRecord = useCallback(() => {
    const next = !isOffRecordRef.current
    isOffRecordRef.current = next
    setIsOffRecord(next)
    onOffRecordChangeRef.current(next, elapsed())
  }, [elapsed])

  const confirmForget = useCallback(() => {
    if (!isConnectedRef.current) return
    sendUserMessage('[FORGET] Last question and 2 minutes of recording deleted.')
  }, [sendUserMessage])

  return {
    isConnected,
    voiceMode,
    isOffRecord,
    isPendingAnswer,
    lastUserSpeechMs,
    startVoice,
    stopVoice,
    pushScreenEvents,
    sendDirectorQuestion,
    toggleOffRecord,
    confirmForget,
  }
}
