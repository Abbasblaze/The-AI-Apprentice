import Link from 'next/link'

export default function HomePage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-paper)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          height: '52px',
          padding: '0 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '7px',
            background: 'linear-gradient(135deg, #3d7eff 0%, #7c3aed 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.5" fill="white" />
            <circle
              cx="7"
              cy="7"
              r="5.5"
              stroke="white"
              strokeWidth="1.2"
              strokeOpacity="0.5"
              fill="none"
            />
          </svg>
        </span>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--color-ink)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          AI Apprentice
        </span>
      </header>
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '48px 24px',
          maxWidth: '480px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <Link
            href="/expert"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '22px 24px',
              background: 'var(--color-panel)',
              textDecoration: 'none',
            }}
          >
            <span
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-heading)',
              }}
            >
              Expert
            </span>
            <span style={{ fontSize: '13px', color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
              Teach the apprentice a task.
            </span>
          </Link>
          <div style={{ height: '1px', background: 'var(--color-border)' }} />
          <Link
            href="/learn"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '22px 24px',
              background: 'var(--color-panel)',
              textDecoration: 'none',
            }}
          >
            <span
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-heading)',
              }}
            >
              Learner
            </span>
            <span style={{ fontSize: '13px', color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
              Learn a task with the tutor.
            </span>
          </Link>
        </div>
      </main>
    </div>
  )
}
