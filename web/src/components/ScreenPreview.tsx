'use client'

import { useCallback, useRef, useState } from 'react'

import type { MaskRegion } from '@/lib/types'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isSharing: boolean
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
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-contain"
          style={{
            display: isSharing ? 'block' : 'none',
            backgroundColor: 'var(--color-panel)',
          }}
        />

        {isSharing && (
          <div
            ref={overlayRef}
            className="absolute inset-0"
            style={{ cursor: drawingMode ? 'crosshair' : 'default' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {allRegions.map((region, idx) => (
              <div
                key={idx}
                className="absolute"
                style={{
                  left: `${region.x * 100}%`,
                  top: `${region.y * 100}%`,
                  width: `${region.width * 100}%`,
                  height: `${region.height * 100}%`,
                  backgroundColor: 'rgba(26, 26, 26, 0.75)',
                  border: '1px solid var(--color-graphite)',
                }}
              />
            ))}
          </div>
        )}

        {!isSharing && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            style={{ backgroundColor: 'var(--color-panel)' }}
          >
            <p
              className="text-sm text-center"
              style={{ color: 'var(--color-graphite)', maxWidth: '28ch' }}
            >
              Share a window to begin capturing events.
            </p>
          </div>
        )}
      </div>

      {isSharing && (
        <div className="shrink-0 px-4 py-2 flex items-center gap-3">
          <button
            onClick={() => setDrawingMode((prev) => !prev)}
            className="px-3 py-1 text-xs"
            style={{
              border: '1px solid var(--color-rule)',
              borderRadius: '4px',
              color: 'var(--color-graphite)',
              backgroundColor: drawingMode ? 'var(--color-panel)' : 'transparent',
            }}
          >
            {drawingMode ? 'Done masking' : 'Mask regions'}
          </button>
          {maskRegions.length > 0 && (
            <button
              onClick={() => onMaskRegionsChange([])}
              className="px-3 py-1 text-xs"
              style={{
                border: '1px solid var(--color-rule)',
                borderRadius: '4px',
                color: 'var(--color-graphite)',
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
