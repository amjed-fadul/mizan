import { Link, useNavigate } from 'react-router-dom'
import '../market.css'
import Button from '../../shared/Button'
import PrimaryButton from '../PrimaryButton'

var PRODUCTS = [
  {
    id: 'milk-2l',
    name: 'حليب طازج كامل الدسم',
    size: '2 لتر',
    price: 11.5,
    wasPrice: 13.0,
    unit: 5.75,
    unitLabel: 'لتر',
    stock: 'in-stock',
    delivery: 'Today, 6 - 9 PM'
  },
  {
    id: 'bread-arabic',
    name: 'خبز عربي',
    size: '6 أرغفة',
    price: 4.25,
    unit: 0.71,
    unitLabel: 'رغيف',
    stock: 'low-stock',
    delivery: 'Today, 6 - 9 PM'
  },
  {
    id: 'iphone-17-pro',
    name: 'Apple iPhone 17 Pro',
    size: '256GB',
    price: 4699.0,
    wasPrice: 4999.0,
    unit: 4699.0,
    unitLabel: 'unit',
    stock: 'in-stock',
    delivery: 'Tomorrow'
  },
  {
    id: 'tea-lipton',
    name: 'شاي أحمر Lipton',
    size: '100 كيس',
    price: 18.9,
    wasPrice: 22.0,
    unit: 0.19,
    unitLabel: 'كيس',
    stock: 'in-stock',
    delivery: 'Tomorrow'
  },
  {
    id: 'nescafe-gold',
    name: 'Nescafé Gold',
    size: '200g',
    price: 42.0,
    unit: 21.0,
    unitLabel: '100g',
    stock: 'in-stock',
    delivery: 'Tomorrow'
  },
  {
    id: 'rice-basmati',
    name: 'أرز بسمتي',
    size: '5 كجم',
    price: 34.75,
    wasPrice: 39.0,
    unit: 6.95,
    unitLabel: 'كجم',
    stock: 'low-stock',
    delivery: 'Tomorrow'
  },
  {
    id: 'water-al-ain',
    name: 'Al Ain Water',
    size: '24 x 500ml',
    price: 9.95,
    unit: 0.41,
    unitLabel: 'bottle',
    stock: 'in-stock',
    delivery: 'Today, 6 - 9 PM'
  },
  {
    id: 'olive-oil',
    name: 'زيت زيتون بكر ممتاز',
    size: '750 مل',
    price: 27.5,
    unit: 36.67,
    unitLabel: 'لتر',
    stock: 'out-of-stock',
    delivery: 'Out of stock'
  }
]

var STOCK_TEXT = {
  'in-stock': 'In stock',
  'low-stock': 'Low stock',
  'out-of-stock': 'Out of stock'
}

export default function CategoryScreen() {
  var navigate = useNavigate()

  return (
    <div className="container">
      <div className="category-nav">
        <Link to="/">Home</Link> | <Link to="/market">Grocery</Link> |{' '}
        <Link to="/market/cart">Cart</Link> | <Link to="/move">Mizan Move</Link>
      </div>

      <div className="category-header">
        <h1>Grocery &amp; Everyday</h1>
        <p className="muted">Delivered across Dubai and Sharjah, seven days a week.</p>
      </div>

      <div className="card category-filters">
        <span className="badge">All</span>
        <span className="badge">Dairy &amp; Eggs</span>
        <span className="badge">Bakery</span>
        <span className="badge">Pantry</span>
        <span className="badge">Beverages</span>
        <span className="badge">Electronics</span>
        <div className="product-card-actions">
          <Button type="secondary">Sort by Price</Button>
          <Button type="secondary">Filter</Button>
          <PrimaryButton size="sm" onClick={() => navigate('/market/cart')}>
            View Cart (4)
          </PrimaryButton>
        </div>
      </div>

      <div className="product-grid">
        {PRODUCTS.map(function (product) {
          var percentOff = 0
          if (product.wasPrice) {
            percentOff = Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100)
          }

          var stockText = STOCK_TEXT[product.stock]
          if (!stockText) {
            stockText = 'Unavailable'
          }

          return (
            <div className="product-grid-item" key={product.id}>
              <div className="product-card">
                <div className="product-card-image">IMG</div>
                <div className="product-card-body">
                  {product.wasPrice ? (
                    <span className="product-discount">{'-' + percentOff + '%'}</span>
                  ) : null}
                  <div className="product-card-title">
                    <Link to={'/market/product/' + product.id}>
                      {product.name + ' - ' + product.size}
                    </Link>
                  </div>
                  <div className="product-card-row">
                    <span className="product-price">{'AED ' + product.price.toFixed(2)}</span>
                    {product.wasPrice ? (
                      <span className="product-price-was">{'AED ' + product.wasPrice.toFixed(2)}</span>
                    ) : null}
                  </div>
                  <div className="product-card-unit">
                    {'AED ' + product.unit.toFixed(2) + ' per ' + product.unitLabel}
                  </div>
                  <div className="product-card-meta">{stockText}</div>
                  <div className="delivery-note">{'Get it ' + product.delivery}</div>
                  <div className="product-card-actions">
                    <Button disabled={product.stock === 'out-of-stock'}>Add to Cart</Button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="product-card-actions">
        <Button type="secondary">Load More</Button>
      </div>
    </div>
  )
}
