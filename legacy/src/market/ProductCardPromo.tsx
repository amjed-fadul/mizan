import './market.css'
import StockStatus from './StockStatus'

type ProductCardPromoProps = {
  name: string
  price: number
  oldPrice?: number
  stock: string
  delivery: string
  image?: string
}

export default function ProductCardPromo({ name, price, oldPrice, stock, delivery, image }: ProductCardPromoProps) {
  const percentOff = oldPrice ? Math.floor(((oldPrice - price) / oldPrice) * 100) : 0

  return (
    <div
      className="mk-card product-card-promo"
      style={{ width: '240px', marginRight: '16px', padding: '16px', borderRadius: '4px' }}
    >
      <div className="product-card-promo-ribbon">
        {oldPrice ? <span className="mk-badge-discount">{'Save ' + percentOff + '%'}</span> : null}
      </div>
      {image ? (
        <img className="mk-card__media-img" src={image} />
      ) : (
        <div className="mk-card__media">Image</div>
      )}
      <div className="mk-card__body">
        <div className="mk-card__title">{name}</div>
        <div className="product-card-row">
          <span className="product-price">{'AED ' + price.toFixed(2)}</span>
          {oldPrice ? (
            <span className="product-price-was" style={{ color: 'var(--price-was)' }}>
              {'AED ' + oldPrice.toFixed(2)}
            </span>
          ) : null}
        </div>
        <div className="product-card-row">
          <StockStatus status={stock} />
        </div>
        <div className="mk-delivery">{'Arrives ' + delivery}</div>
        <div className="product-card-promo-note">Limited time offer</div>
      </div>
    </div>
  )
}
