export type EventKind =
  | 'opened'
  | 'changed'
  | 'typed'
  | 'selected'
  | 'navigated'
  | 'error'
  | 'other'

export type EventSource = 'vision' | 'erp'

export interface AppEvent {
  id: string
  t: number
  kind: EventKind
  subject: string
  field: string | null
  from_value: string | null
  to_value: string | null
  summary: string
  source: EventSource
}

export interface FrameRequest {
  session_id: string
  t: number
  image: string
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export interface FrameResponse {
  events: AppEvent[]
  usage: TokenUsage
  latency_ms: number
}

export interface SessionStats {
  framesSeen: number
  framesSent: number
  totalLatencyMs: number
  requestCount: number
  totalInputTokens: number
  totalOutputTokens: number
}

export type TranscriptRole = 'user' | 'agent'
export type TranscriptPhase = 'interview' | 'debrief'

export interface TranscriptEntry {
  role: TranscriptRole
  message: string
  t: number
  phase?: TranscriptPhase
}

export type QuestionKind = 'reason' | 'limit' | 'exception' | 'escalation' | 'guardrail'

export interface QuestionEntry {
  id: string
  t: number
  kind: QuestionKind
  text: string
  anchorEventId: string
  answered: boolean
  answerText: string | null
}

export type LedgerEntry =
  | { type: 'event'; data: AppEvent }
  | { type: 'question'; data: QuestionEntry }
  | { type: 'answer'; id: string; t: number; questionId: string; text: string }

export type VoiceMode = 'idle' | 'listening' | 'speaking' | 'waiting' | 'off-record'

export interface QuestionStats {
  asked: number
  answered: number
  guardrail: number
}

export interface DirectorDecideRequest {
  session_id: string
  elapsed_seconds: number
}

export interface DirectorDecideResponse {
  should_ask: boolean
  kind: QuestionKind
  anchor_event_id: string
  question: string
  why: string
  rejected_reason: string | null
}

export interface TranscriptRequest {
  entries: TranscriptEntry[]
}

export interface TranscriptResponse {
  session_id: string
  entries: TranscriptEntry[]
}

export interface StoredDecision {
  id: string
  t: number
  should_ask: boolean
  kind: QuestionKind
  anchor_event_id: string
  question: string
  why: string
  rejected_reason: string | null
  answered: boolean
  answer_text: string | null
}

export interface SnapshotIndexEntry {
  t: number
  filename: string
}

export interface SessionSummary {
  session_id: string
  start_time: number
  end_time: number | null
  event_count: number
  erp_event_count: number
  question_count: number
  has_map: boolean
  debrief_phase: string | null
}

export interface SessionRecord {
  session_id: string
  start_time: number
  end_time: number | null
  events: AppEvent[]
  erp_events: AppEvent[]
  transcript: TranscriptEntry[]
  decisions: StoredDecision[]
  snapshots: SnapshotIndexEntry[]
}

export type GuardrailKind = 'limit' | 'exception' | 'hold' | 'stop_and_ask'
export type GapKind = 'missing_reason' | 'unclear_guardrail' | 'scope' | 'authority' | 'unseen_case' | 'never_do'
export type GapPriority = 'high' | 'normal'

export interface Gap {
  id: string
  step_id: string | null
  kind: GapKind
  question: string
  priority: GapPriority
  closed: boolean
}

export interface ScreenMoment {
  t: number
  snapshot_t: number
  subject: string
}

export interface StepReason {
  text: string
  quote: string | null
  quote_t: number | null
  unconfirmed: boolean
}

export interface Guardrail {
  id: string
  kind: GuardrailKind
  rule: string
  quote: string
  quote_t: number
  who_to_ask: string | null
  applies_to: string | null
}

export interface Step {
  id: string
  order: number
  title: string
  screen_moment: ScreenMoment
  decision: string
  reason: StepReason
  is_judgment_call: boolean
  guardrails: Guardrail[]
  confidence: number
  open_gaps: string[]
}

export interface TeachbackRound {
  text: string
  expert_reply: string
  classification: 'confirmed' | 'corrected' | 'unclear'
  correction: string | null
  patch_summary: string | null
}

export interface WorkMap {
  session_id: string
  process_name: string
  summary: string
  steps: Step[]
  expert_confirmed: boolean
  confirmed_at: number | null
  teachback_rounds: TeachbackRound[]
  version: number
}

export type DebriefPhase = 'gathering' | 'teachback' | 'confirmed'

export interface DebriefStartResponse {
  gap: Gap
  state: { phase: DebriefPhase; gaps_answered: number; total_gaps: number }
  map: WorkMap
}

export interface DebriefAnswerResponse {
  next_gap: Gap | null
  teachback: string | null
  move_reason: string | null
  map: WorkMap
}

export interface DebriefReplyResponse {
  classification: 'confirmed' | 'corrected' | 'unclear'
  partial_teachback: string | null
  confirmed: boolean
  map: WorkMap
}
