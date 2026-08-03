import './move.css'

type FareProps = {
  amount: number
  estimate?: boolean
  surcharge?: number
  caption?: string
}

export default function Fare({ amount, estimate, surcharge, caption }: FareProps) {
  var text = 'AED ' + amount.toFixed(1)
  var amountClass = 'mv-fare__amount'

  if (estimate) {
    text = 'from AED ' + Math.round(amount)
    amountClass = 'mv-fare__amount mv-fare__amount--estimate'
  }

  return (
    <span className="mv-fare">
      <span className={amountClass}>{text}</span>
      {surcharge ? (
        <span className="mv-fare__surcharge">{'+ AED ' + surcharge + ' surcharge'}</span>
      ) : null}
      {caption ? <span className="mv-fare__caption">{caption}</span> : null}
    </span>
  )
}
