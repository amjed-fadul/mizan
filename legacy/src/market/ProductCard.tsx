import './market.css'
import Price from './Price'
import StockStatus from './StockStatus'

type ProductCardProps = {
  name: string
  price: number
  wasPrice?: number
  stock: string
  delivery: string
  image?: string
}

export default function ProductCard({ name, price, wasPrice, stock, delivery, image }: ProductCardProps) {
  var percentOff = 0
  if (wasPrice) {
    percentOff = Math.round(((wasPrice - price) / wasPrice) * 100)
  }

  return (
    <div className="mk-card" style={{ width: '240px', marginRight: 'var(--space-2)' }}>
      {image ? (
        <img className="mk-card__media-img" src={image} />
      ) : (
        <div className="mk-card__media">Image</div>
      )}
      <div className="mk-card__body">
        <div className="mk-card__title">{name}</div>
        {wasPrice ? <span className="mk-badge-discount">{percentOff + '% OFF'}</span> : null}
        <div className="mk-card__row">
          <Price amount={price} wasAmount={wasPrice} showPercentOff={false} />
        </div>
        <div className="mk-card__row">
          <StockStatus status={stock} />
        </div>
        <div className="mk-delivery">{'Delivery: ' + delivery}</div>
      </div>
    </div>
  )
}
