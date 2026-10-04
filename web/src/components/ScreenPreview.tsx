'use client'

import { useCallback, useRef, useState } from 'react'

import type { MaskRegion } from '@/lib/types'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isSharing: boolean
  isOffRecord?: boolean
  maskRegions: MaskRegion[]
  onMaskRegionsChange: (regions: MaskRegion[]) => void
}

interface Point {
  x: number
  y: number
}

function normalize(rect: MaskRegion): MaskRegion {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x
  const y = rect.height < 0 ? rect.y + rect.height : rect.y
  return { x, y, width: Math.abs(rect.width), height: Math.abs(rect.height) }
}

export function ScreenPreview({
  videoRef,
  isSharing,
  isOffRecord = false,
  maskRegions,
  onMaskRegionsChange,
}: Props) {
  const [drawingMode, setDrawingMode] = useState(false)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  const pointFromEvent = useCallback((e: React.MouseEvent): Point => {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!drawingMode) return
      setDragStart(pointFromEvent(e))
      setDragCurrent(pointFromEvent(e))
    },
    [drawingMode, pointFromEvent],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawingMode || !dragStart) return
      setDragCurrent(pointFromEvent(e))
    },
    [drawingMode, dragStart, pointFromEvent],
  )

  const handleMouseUp = useCallback(() => {
    if (!drawingMode || !dragStart || !dragCurrent) {
      setDragStart(null)
      setDragCurrent(null)
      return
    }
    const region = normalize({
      x: dragStart.x,
      y: dragStart.y,
      width: dragCurrent.x - dragStart.x,
      height: dragCurrent.y - dragStart.y,
    })
    if (region.width > 0.01 && region.height > 0.01) {
      onMaskRegionsChange([...maskRegions, region])
    }
    setDragStart(null)
    setDragCurrent(null)
  }, [drawingMode, dragStart, dragCurrent, maskRegions, onMaskRegionsChange])

  const liveRegion =
    dragStart && dragCurrent
      ? normalize({
          x: dragStart.x,
          y: dragStart.y,
          width: dragCurrent.x - dragStart.x,
          height: dragCurrent.y - dragStart.y,
        })
      : null

  const allRegions = liveRegion ? [...maskRegions, liveRegion] : maskRegions

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {/* Video element — hidden until sharing starts */}
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-contain"
          style={{
            display: isSharing ? 'block' : 'none',
            backgroundColor: '#0d0d0d',
            borderRadius: '8px',
            boxShadow: '0 0 0 1px #3d7eff40',
          }}
        />

        {/* Interaction / mask overlay — sits above video while sharing */}
        {isSharing && (
          <div
            ref={overlayRef}
            className="absolute inset-0"
            style={{
              cursor: drawingMode ? 'crosshair' : 'default',
              borderRadius: '8px',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Committed + live-draw mask regions */}
            {allRegions.map((region, idx) => (
              <div
                key={idx}
                className="absolute"
                style={{
                  left: `${region.x * 100}%`,
                  top: `${region.y * 100}%`,
                  width: `${region.width * 100}%`,
                  height: `${region.height * 100}%`,
                  backgroundColor: 'rgba(13, 13, 13, 0.82)',
                  border: '1px solid rgba(61, 126, 255, 0.25)',
                  borderRadius: '2px',
                }}
              />
            ))}
          </div>
        )}

        {/* Off-the-record amber tint overlay */}
        {isSharing && isOffRecord && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              backgroundColor: 'rgba(180, 100, 0, 0.18)',
              borderRadius: '8px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'rgba(251, 191, 36, 0.85)',
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                padding: '3px 10px',
                borderRadius: '4px',
                border: '1px solid rgba(251, 191, 36, 0.25)',
              }}
            >
              Off the record
            </span>
          </div>
        )}

        {/* Empty / placeholder state */}
        {!isSharing && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              backgroundColor: '#111214',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <p
              className="text-sm text-center"
              style={{
                color: 'rgba(255, 255, 255, 0.28)',
                maxWidth: '24ch',
                lineHeight: 1.5,
              }}
            >
              Share your screen to begin
            </p>
          </div>
        )}
      </div>

      {/* Mask-region toolbar — only shown while sharing */}
      {isSharing && (
        <div className="shrink-0 px-3 py-2 flex items-center gap-2">
          <button
            onClick={() => setDrawingMode((prev) => !prev)}
            className="px-3 py-1 text-xs transition-colors"
            style={{
              border: `1px solid ${drawingMode ? 'rgba(61, 126, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '4px',
              color: drawingMode ? 'rgba(61, 126, 255, 0.9)' : 'rgba(255, 255, 255, 0.45)',
              backgroundColor: drawingMode ? 'rgba(61, 126, 255, 0.08)' : 'transparent',
            }}
          >
            {drawingMode ? 'Done masking' : 'Mask regions'}
          </button>
          {maskRegions.length > 0 && (
            <button
              onClick={() => onMaskRegionsChange([])}
              className="px-3 py-1 text-xs transition-colors"
              style={{
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.35)',
                backgroundColor: 'transparent',
              }}
            >
              Clear masks
            </button>
          )}
        </div>
      )}
    </div>
  )
}
