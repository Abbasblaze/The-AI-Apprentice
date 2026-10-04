import type {
  AppEvent,
  CheckVerdict,
  DebriefAnswerResponse,
  DebriefReplyResponse,
  DebriefStartResponse,
  DirectorDecideRequest,
  DirectorDecideResponse,
  FrameRequest,
  FrameResponse,
  MasterySummary,
  SessionRecord,
  SessionSummary,
  TranscriptEntry,
  TranscriptResponse,
  TutorSession,
  WorkMap,
} from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function postFrame(req: FrameRequest): Promise<FrameResponse> {
  return apiFetch<FrameResponse>('/api/frames', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function fetchSignedUrl(role: 'interviewer' | 'debrief' | 'tutor' = 'interviewer'): Promise<string> {
  const data = await apiFetch<{ signed_url: string }>(`/api/voice/signed-url?role=${role}`)
  return data.signed_url
}

export async function postTranscriptEntries(
  sessionId: string,
  entries: TranscriptEntry[],
): Promise<void> {
  await apiFetch<TranscriptResponse>(`/api/sessions/${sessionId}/transcript`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  })
}

export async function postDirectorDecide(
  req: DirectorDecideRequest,
): Promise<DirectorDecideResponse> {
  return apiFetch<DirectorDecideResponse>('/api/director/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function postErpEvents(sessionId: string, events: AppEvent[]): Promise<void> {
  await apiFetch<unknown>(`/api/sessions/${sessionId}/erp-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  })
}

export async function endSession(sessionId: string): Promise<void> {
  await apiFetch<unknown>(`/api/sessions/${sessionId}/end`, {
    method: 'POST',
  })
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const data = await apiFetch<{ sessions: SessionSummary[] }>('/api/sessions')
  return data.sessions
}

export async function fetchSession(sessionId: string): Promise<SessionRecord> {
  return apiFetch<SessionRecord>(`/api/sessions/${sessionId}`)
}

export function snapshotUrl(sessionId: string, t: number): string {
  return `${API_BASE}/api/sessions/${sessionId}/snapshots/${t.toFixed(3)}`
}

export async function startDebrief(sessionId: string): Promise<DebriefStartResponse> {
  return apiFetch<DebriefStartResponse>(`/api/sessions/${sessionId}/debrief/start`, {
    method: 'POST',
  })
}

export async function answerDebrief(sessionId: string, answer: string): Promise<DebriefAnswerResponse> {
  return apiFetch<DebriefAnswerResponse>(`/api/sessions/${sessionId}/debrief/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  })
}

export async function replyDebrief(sessionId: string, reply: string): Promise<DebriefReplyResponse> {
  return apiFetch<DebriefReplyResponse>(`/api/sessions/${sessionId}/debrief/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply }),
  })
}

export async function fetchMap(sessionId: string): Promise<WorkMap> {
  return apiFetch<WorkMap>(`/api/sessions/${sessionId}/map`)
}

export interface InvoiceStateIn {
  supplier: string
  country: string
  amount: number
  cost_center: string
  asset_number: string
  status: string
  internal_note: string
}

export interface ErpActionCheck {
  action_type: string
  action_value: string | null
}

export async function createTutorSession(workMapSessionId: string): Promise<TutorSession> {
  return apiFetch<TutorSession>('/api/tutor/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ work_map_session_id: workMapSessionId }),
  })
}

export async function getTutorSession(id: string): Promise<TutorSession> {
  return apiFetch<TutorSession>(`/api/tutor/sessions/${id}`)
}

export async function endTutorSession(id: string): Promise<void> {
  await apiFetch<unknown>(`/api/tutor/sessions/${id}/end`, { method: 'POST' })
}

export async function checkAction(
  tutorId: string,
  action: ErpActionCheck,
  invoice: InvoiceStateIn,
): Promise<CheckVerdict> {
  return apiFetch<CheckVerdict>(`/api/tutor/sessions/${tutorId}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...action, invoice }),
  })
}

export async function getTutorSummary(id: string): Promise<MasterySummary> {
  return apiFetch<MasterySummary>(`/api/tutor/sessions/${id}/summary`, { method: 'POST' })
}

export async function listTutorSessions(): Promise<TutorSession[]> {
  return apiFetch<TutorSession[]>('/api/tutor/sessions')
}

export async function listMapsForTutor(): Promise<WorkMap[]> {
  const sessions = await apiFetch<{ sessions: SessionSummary[] }>('/api/sessions')
  const maps = await Promise.all(
    sessions.sessions
      .filter((s) => s.has_map)
      .map((s) =>
        apiFetch<WorkMap>(`/api/sessions/${s.session_id}/map`).catch(() => null),
      ),
  )
  return maps.filter(
    (m): m is WorkMap => m !== null && (m.expert_confirmed || m.demo_ready),
  )
}
