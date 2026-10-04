'use client'

import { useEffect, useRef } from 'react'

import { encodeJpeg, meanDiff, sampleGrayscale } from '@/lib/changeDetection'
import type { MaskRegion } from '@/lib/types'

const SAMPLE_SIZE = 32
const DEFAULT_INTERVAL = 2000
const DEFAULT_THRESHOLD = 8

interface Options {
  videoRef: React.RefObject<HTMLVideoElement | null>
  enabled: boolean
  onSample: (imageB64: string | null) => void
  maskRegions?: MaskRegion[]
  interval?: number
  threshold?: number
}

export function useFrameSampler({
  videoRef,
  enabled,
  onSample,
  maskRegions = [],
  interval = DEFAULT_INTERVAL,
  threshold = DEFAULT_THRESHOLD,
}: Options): void {
  const prevGrayRef = useRef<Uint8ClampedArray | null>(null)
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const encodeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const onSampleRef = useRef(onSample)
  const maskRegionsRef = useRef(maskRegions)

  useEffect(() => {
    onSampleRef.current = onSample
  }, [onSample])

  useEffect(() => {
    maskRegionsRef.current = maskRegions
  }, [maskRegions])

  useEffect(() => {
    const sampleCanvas = document.createElement('canvas')
    sampleCanvas.width = SAMPLE_SIZE
    sampleCanvas.height = SAMPLE_SIZE
    sampleCanvas.getContext('2d', { willReadFrequently: true })
    sampleCanvasRef.current = sampleCanvas

    const encodeCanvas = document.createElement('canvas')
    encodeCanvasRef.current = encodeCanvas

    return () => {
      sampleCanvasRef.current = null
      encodeCanvasRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      prevGrayRef.current = null
      return
    }

    const id = setInterval(() => {
      const video = videoRef.current
      const sampleCanvas = sampleCanvasRef.current
      const encodeCanvas = encodeCanvasRef.current

      if (
        !video ||
        !sampleCanvas ||
        !encodeCanvas ||
        video.readyState < 2 ||
        video.videoWidth === 0
      ) {
        return
      }

      let gray: Uint8ClampedArray
      try {
        gray = sampleGrayscale(video, sampleCanvas)
      } catch {
        return
      }

      const prev = prevGrayRef.current
      prevGrayRef.current = gray

      if (prev !== null && meanDiff(gray, prev) < threshold) {
        onSampleRef.current(null)
        return
      }

      try {
        const b64 = encodeJpeg(video, encodeCanvas, 0.7, maskRegionsRef.current)
        onSampleRef.current(b64)
      } catch {
        onSampleRef.current(null)
      }
    }, interval)

    return () => clearInterval(id)
  }, [enabled, videoRef, interval, threshold])
}
