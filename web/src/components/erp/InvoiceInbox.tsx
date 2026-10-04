import type { ErpAction, Invoice, InvoiceStatus } from '@/lib/erp/types'

interface Props {
  invoices: Invoice[]
  dispatch: (action: ErpAction) => void
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: 'Open',
  held: 'On Hold',
  'awaiting-approval': 'Awaiting Approval',
  posted: 'Posted',
}

const STATUS_STYLE: Record<InvoiceStatus, { color: string; bg: string; border: string }> = {
  open: { color: '#c9d1d9', bg: 'rgba(201,209,217,0.08)', border: 'rgba(201,209,217,0.2)' },
  held: { color: '#e3b341', bg: 'rgba(227,179,65,0.1)', border: 'rgba(227,179,65,0.3)' },
  'awaiting-approval': { color: '#388bfd', bg: 'rgba(56,139,253,0.1)', border: 'rgba(56,139,253,0.3)' },
  posted: { color: '#3fb950', bg: 'rgba(63,185,80,0.1)', border: 'rgba(63,185,80,0.3)' },
}

function fmtAmount(amount: number): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function InvoiceInbox({ invoices, dispatch }: Props) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #21262d', background: '#161b22' }}>
            <th style={th}>Number</th>
            <th style={th}>Supplier</th>
            <th style={th}>Country</th>
            <th style={{ ...th, textAlign: 'right' }}>Amount EUR</th>
            <th style={th}>Status</th>
            <th style={th}>Due Date</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const ss = STATUS_STYLE[inv.status]
            return (
              <tr
                key={inv.id}
                onClick={() => dispatch({ type: 'SELECT_INVOICE', invoice_id: inv.id })}
                style={{ borderBottom: '1px solid #21262d', cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLTableRowElement).style.background = '#1c2128'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLTableRowElement).style.background = ''
                }}
              >
                <td style={{ ...td, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#e6edf3' }}>
                  {inv.number}
                </td>
                <td style={td}>{inv.supplier}</td>
                <td style={td}>{inv.country}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace' }}>
                  {fmtAmount(inv.amount)}
                </td>
                <td style={td}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    color: ss.color,
                    background: ss.bg,
                    border: `1px solid ${ss.border}`,
                  }}>
                    {STATUS_LABEL[inv.status]}
                  </span>
                </td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace' }}>{fmtDate(inv.due_date)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '7px 14px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#8b949e',
  fontSize: '11px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '9px 14px',
  color: '#8b949e',
  whiteSpace: 'nowrap',
}
