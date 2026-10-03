import type {
  AppEvent,
  DirectorDecideRequest,
  DirectorDecideResponse,
  FrameRequest,
  FrameResponse,
  SessionRecord,
  SessionSummary,
  TranscriptEntry,
  TranscriptResponse,
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

export async function fetchSignedUrl(): Promise<string> {
  const data = await apiFetch<{ signed_url: string }>('/api/voice/signed-url')
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
