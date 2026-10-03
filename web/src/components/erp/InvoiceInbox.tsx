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

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  open: '#1A1A1A',
  held: '#B45309',
  'awaiting-approval': '#1D4ED8',
  posted: '#15803D',
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
          <tr style={{ borderBottom: '1px solid #D0D0CE', background: '#F0F0EE' }}>
            <th style={th}>Number</th>
            <th style={th}>Supplier</th>
            <th style={th}>Country</th>
            <th style={{ ...th, textAlign: 'right' }}>Amount EUR</th>
            <th style={th}>Status</th>
            <th style={th}>Due Date</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              onClick={() => dispatch({ type: 'SELECT_INVOICE', invoice_id: inv.id })}
              style={{ borderBottom: '1px solid #E8E8E6', cursor: 'pointer' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLTableRowElement).style.background = '#F0F0EE'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLTableRowElement).style.background = ''
              }}
            >
              <td style={{ ...td, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                {inv.number}
              </td>
              <td style={td}>{inv.supplier}</td>
              <td style={td}>{inv.country}</td>
              <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {fmtAmount(inv.amount)}
              </td>
              <td style={{ ...td, color: STATUS_COLOR[inv.status] }}>
                {STATUS_LABEL[inv.status]}
              </td>
              <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(inv.due_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '6px 12px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#5A5A58',
  fontSize: '12px',
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '7px 12px',
  color: '#1A1A1A',
  whiteSpace: 'nowrap',
}
