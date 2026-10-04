'use client'
import Link from 'next/link'

interface Props {
  mode: 'expert' | 'learner'
}

const NAV: Record<'expert' | 'learner', { label: string; href: string }[]> = {
  expert: [
    { label: 'Record', href: '/expert' },
    { label: 'Sessions', href: '/expert/sessions' },
  ],
  learner: [
    { label: 'Maps', href: '/learn' },
    { label: 'My sessions', href: '/learn/sessions' },
  ],
}

const SWITCH: Record<'expert' | 'learner', { label: string; href: string }> = {
  expert: { label: 'Learner', href: '/learn' },
  learner: { label: 'Expert', href: '/expert' },
}

export function ModeHeader({ mode }: Props) {
  return (
    <header
      style={{
        height: '52px',
        padding: '0 20px',
        background: 'rgba(10,13,20,0.96)',
        borderBottom: '1px solid var(--color-border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.2" strokeOpacity="0.5" fill="none" />
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
        </Link>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-muted)',
          }}
        >
          {mode}
        </span>
      </div>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {NAV[mode].map(({ label, href }) => (
          <Link key={href} href={href} className="nav-link">
            {label}
          </Link>
        ))}
        <div style={{ width: '1px', height: '16px', background: 'var(--color-border)' }} />
        <Link
          href={SWITCH[mode].href}
          style={{
            fontSize: '12px',
            color: 'var(--color-ink-muted)',
            textDecoration: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: '5px',
            padding: '3px 10px',
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          {SWITCH[mode].label} mode
        </Link>
      </nav>
    </header>
  )
}
