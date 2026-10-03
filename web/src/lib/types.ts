export type EventKind =
  | 'opened'
  | 'changed'
  | 'typed'
  | 'selected'
  | 'navigated'
  | 'error'
  | 'other'

export interface AppEvent {
  id: string
  t: number
  kind: EventKind
  subject: string
  field: string | null
  from_value: string | null
  to_value: string | null
  summary: string
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
