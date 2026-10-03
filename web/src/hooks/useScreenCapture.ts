'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface ScreenCaptureResult {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isSharing: boolean
  error: string | null
  startSharing: () => Promise<void>
  stopSharing: () => void
}

export function useScreenCapture(onStop: () => void): ScreenCaptureResult {
  const [isSharing, setIsSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onStopRef = useRef(onStop)

  useEffect(() => {
    onStopRef.current = onStop
  }, [onStop])

  const stopSharing = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
    setIsSharing(false)
    onStopRef.current()
  }, [])

  const startSharing = useCallback(async () => {
    setError(null)
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })
      s.getTracks().forEach((track) => {
        track.addEventListener('ended', stopSharing)
      })
      streamRef.current = s
      const video = videoRef.current
      if (video) {
        video.srcObject = s
        await video.play().catch(() => {})
      }
      setIsSharing(true)
    } catch (err) {
      if (err instanceof Error && err.name !== 'NotAllowedError') {
        setError(
          `Could not access screen: ${err.message}. Check browser permissions.`,
        )
      }
    }
  }, [stopSharing])

  return { videoRef, isSharing, error, startSharing, stopSharing }
}
