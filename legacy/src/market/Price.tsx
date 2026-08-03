import './market.css'

type PriceProps = {
  amount: number
  wasAmount?: number
  size?: 'sm' | 'md'
  showPercentOff?: boolean
}

export default function Price({ amount, wasAmount, size, showPercentOff }: PriceProps) {
  var className = 'mk-price'
  if (size === 'sm') {
    className = 'mk-price mk-price--sm'
  }

  var current = 'AED ' + amount.toFixed(2)
  var was = ''
  var percentOff = 0

  if (wasAmount) {
    was = 'AED ' + wasAmount.toFixed(2)
    percentOff = Math.round(((wasAmount - amount) / wasAmount) * 100)
  }

  var showOff = showPercentOff !== false

  return (
    <span className={className}>
      <span className="mk-price__current">{current}</span>
      {was ? <span className="mk-price__was">{was}</span> : null}
      {was && showOff ? <span className="mk-price__off">{percentOff + '% off'}</span> : null}
    </span>
  )
}
