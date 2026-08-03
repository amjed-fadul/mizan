import './market.css'
import Price from './Price'

type ProductCardCompactProps = {
  name: string
  price: number
  wasPrice?: number
  stock: string
  delivery?: string
}

const STOCK_LABELS = {
  'in-stock': { text: 'In stock', color: '#2f8560' },
  'low-stock': { text: 'Low stock', color: '#e08a00' },
  'out-of-stock': { text: 'Out of stock', color: '#b0b0b0' }
}

export default function ProductCardCompact({ name, price, wasPrice, stock, delivery }: ProductCardCompactProps) {
  var percentOff = 0
  if (wasPrice) {
    percentOff = Math.round(((wasPrice - price) / wasPrice) * 100)
  }

  var stockLabel = STOCK_LABELS[stock]
  if (!stockLabel) {
    stockLabel = { text: 'Unavailable', color: '#8e8e8e' }
  }

  return (
    <div className="product-card" style={{ width: '180px', marginRight: '12px' }}>
      <div className="product-card-image">IMG</div>
      <div className="product-card-body">
        {wasPrice ? <span className="product-discount">{'-' + percentOff + '%'}</span> : null}
        <div className="product-card-title">{name}</div>
        <div className="product-card-row">
          <Price amount={price} wasAmount={wasPrice} size="sm" />
        </div>
        <div className="product-card-row">
          <span style={{ color: stockLabel.color, fontSize: '13px', fontWeight: 600 }}>{stockLabel.text}</span>
        </div>
        {delivery ? <div className="delivery-note">{'Get it ' + delivery}</div> : null}
      </div>
    </div>
  )
}
