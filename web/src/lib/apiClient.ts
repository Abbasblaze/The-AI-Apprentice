import type { FrameRequest, FrameResponse } from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function postFrame(req: FrameRequest): Promise<FrameResponse> {
  const res = await fetch(`${API_BASE}/api/frames`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
    )
  }
  return res.json() as Promise<FrameResponse>
}
