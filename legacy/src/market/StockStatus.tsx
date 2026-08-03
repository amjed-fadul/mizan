import './market.css'

type StockStatusProps = {
  status: string
}

const STATUS_MAP = {
  'in-stock': { label: 'In Stock', color: 'var(--stock-ok)' },
  'low-stock': { label: 'Only a Few Left', color: 'var(--stock-low)' },
  'out-of-stock': { label: 'Out of Stock', color: 'var(--stock-out)' },
  preparing: { label: 'Preparing Your Order', color: 'var(--color-neutral-700)' },
  shipped: { label: 'Shipped', color: 'var(--color-brand-500)' },
  delivered: { label: 'Delivered', color: 'var(--color-brand-600)' }
}

export default function StockStatus({ status }: StockStatusProps) {
  var entry = STATUS_MAP[status]
  if (!entry) {
    entry = { label: 'Unavailable', color: 'var(--color-neutral-500)' }
  }

  return (
    <span className="mk-stock" style={{ color: entry.color, borderColor: entry.color }}>
      {entry.label}
    </span>
  )
}
