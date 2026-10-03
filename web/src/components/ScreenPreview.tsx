'use client'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isSharing: boolean
}

export function ScreenPreview({ videoRef, isSharing }: Props) {
  return (
    <div className="relative w-full h-full overflow-hidden">
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
  )
}
