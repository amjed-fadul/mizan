import { Link, useParams, useNavigate } from 'react-router-dom'
import '../market.css'
import Price from '../Price'
import StockStatus from '../StockStatus'
import PrimaryButton from '../PrimaryButton'
import Button from '../../shared/Button'

const CATALOGUE = {
  'milk-2l': {
    name: 'حليب طازج كامل الدسم',
    size: '2 لتر',
    price: 11.5,
    wasPrice: 13.0,
    stock: 'in-stock',
    delivery: 'Today, 6 - 9 PM',
    brand: 'Al Rawabi',
    origin: 'United Arab Emirates',
    sku: 'MK-40218',
    description:
      'Fresh full fat cow milk, pasteurised and bottled in Dubai. Keep refrigerated between 2 and 5 degrees.'
  },
  'bread-arabic': {
    name: 'خبز عربي',
    size: '6 أرغفة',
    price: 4.25,
    stock: 'low-stock',
    delivery: 'Today, 6 - 9 PM',
    brand: 'Modern Bakery',
    origin: 'United Arab Emirates',
    sku: 'MK-11907',
    description: 'Soft Arabic flatbread baked daily. Best eaten the same day.'
  },
  'iphone-17-pro': {
    name: 'Apple iPhone 17 Pro',
    size: '256GB',
    price: 4699.0,
    wasPrice: 4999.0,
    stock: 'in-stock',
    delivery: 'Tomorrow',
    brand: 'Apple',
    origin: 'China',
    sku: 'MK-90551',
    description:
      'Titanium body, 6.3 inch display, three camera system. Includes UAE warranty and a USB-C cable.'
  },
  'tea-lipton': {
    name: 'شاي أحمر Lipton',
    size: '100 كيس',
    price: 18.9,
    wasPrice: 22.0,
    stock: 'in-stock',
    delivery: 'Tomorrow',
    brand: 'Lipton',
    origin: 'Kenya',
    sku: 'MK-33740',
    description: 'Yellow label black tea, 100 tagged bags in a resealable carton.'
  },
  'nescafe-gold': {
    name: 'Nescafé Gold',
    size: '200g',
    price: 42.0,
    stock: 'in-stock',
    delivery: 'Tomorrow',
    brand: 'Nestlé',
    origin: 'Switzerland',
    sku: 'MK-77120',
    description: 'Instant coffee jar, medium roast, 200g.'
  },
  'rice-basmati': {
    name: 'أرز بسمتي',
    size: '5 كجم',
    price: 34.75,
    wasPrice: 39.0,
    stock: 'low-stock',
    delivery: 'Tomorrow',
    brand: 'India Gate',
    origin: 'India',
    sku: 'MK-20884',
    description: 'Aged long grain basmati rice, 5 kg bag.'
  },
  'water-al-ain': {
    name: 'Al Ain Water',
    size: '24 x 500ml',
    price: 9.95,
    stock: 'in-stock',
    delivery: 'Today, 6 - 9 PM',
    brand: 'Al Ain',
    origin: 'United Arab Emirates',
    sku: 'MK-10002',
    description: 'Bottled drinking water, pack of 24.'
  },
  'olive-oil': {
    name: 'زيت زيتون بكر ممتاز',
    size: '750 مل',
    price: 27.5,
    stock: 'out-of-stock',
    delivery: 'Out of stock',
    brand: 'Al Jouf',
    origin: 'Saudi Arabia',
    sku: 'MK-55613',
    description: 'Extra virgin olive oil, cold pressed, dark glass bottle.'
  }
}

export default function ProductDetailScreen() {
  const params = useParams()
  const navigate = useNavigate()

  var product = CATALOGUE[params.id]
  if (!product) {
    product = CATALOGUE['milk-2l']
  }

  var percentOff = 0
  if (product.wasPrice) {
    percentOff = Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100)
  }

  return (
    <div className="container">
      <div className="mk-screen-nav">
        <Link to="/">Home</Link> | <Link to="/market">Grocery</Link> |{' '}
        <Link to="/market/cart">Cart</Link> | <Link to="/move">Mizan Move</Link>
      </div>

      {/* copied from CategoryScreen, refactor later */}
      <div className="card category-filters" style={{ padding: '13px' }}>
        <div
          className="badge"
          style={{
            backgroundColor: '#eaeaea',
            color: '#2e2e2e',
            border: '1px solid #eaeaea',
            padding: '7px 13px',
            cursor: 'pointer'
          }}
        >
          All
        </div>
        <div
          className="badge"
          style={{
            backgroundColor: '#ffffff',
            color: '#767676',
            border: '1px solid #eaeaea',
            padding: '7px 13px',
            cursor: 'pointer'
          }}
        >
          Dairy &amp; Eggs
        </div>
        <div
          className="badge"
          style={{
            backgroundColor: '#ffffff',
            color: '#767676',
            border: '1px solid #eaeaea',
            padding: '7px 13px',
            cursor: 'pointer'
          }}
        >
          Pantry
        </div>
        <div
          className="badge"
          style={{
            backgroundColor: '#ffffff',
            color: '#767676',
            border: '1px solid #eaeaea',
            padding: '7px 13px',
            cursor: 'pointer'
          }}
        >
          Beverages
        </div>
      </div>

      <div className="product-detail">
        <div className="product-detail-media">
          <div className="mk-card__media">Image</div>
        </div>

        <div className="product-detail-info">
          <div className="product-detail-title" style={{ fontSize: '22px' }}>
            {product.name + ' - ' + product.size}
          </div>
          <div className="product-card-meta" style={{ color: '#767676' }}>
            {'Brand: ' + product.brand}
          </div>

          {product.wasPrice ? (
            <div className="product-card-row">
              <span className="mk-badge-discount" style={{ backgroundColor: '#c0392b' }}>
                {'Save ' + percentOff + '%'}
              </span>
            </div>
          ) : null}

          <div className="mk-card__row">
            <Price amount={product.price} wasAmount={product.wasPrice} />
          </div>

          <div className="product-card-row">
            <StockStatus status={product.stock} />
          </div>

          <div className="delivery-note">{'Delivery: ' + product.delivery}</div>

          <div className="mk-card__footer">
            <PrimaryButton size="lg" disabled={product.stock === 'out-of-stock'}>
              Add to Cart
            </PrimaryButton>
            <PrimaryButton variant="secondary" size="lg">
              Save for Later
            </PrimaryButton>
            <Button type="secondary" onClick={() => navigate('/market')}>
              Back to Grocery
            </Button>
            <button className="btn btn-cta" onClick={() => navigate('/market/cart')}>
              Buy Now
            </button>
          </div>
        </div>
      </div>

      <div
        className="mk-card product-detail-section"
        style={{ borderRadius: '4px', padding: '13px' }}
      >
        <h3 style={{ fontSize: '18px', marginBottom: '7px' }}>Product Details</h3>
        <p style={{ color: '#2e2e2e' }}>{product.description}</p>
        <div className="product-detail-spec">{'Size: ' + product.size}</div>
        <div className="product-detail-spec">{'Country of origin: ' + product.origin}</div>
        <div className="product-detail-spec" style={{ color: '#767676' }}>
          {'SKU: ' + product.sku}
        </div>
      </div>

      {/* temporary - use the real component once design signs off */}
      <div className="product-detail-section">
        <h2 style={{ fontSize: '22px', marginBottom: '18px' }}>Customers Also Bought</h2>
        <div className="product-grid">
          <div className="product-grid-item">
            <div className="product-card">
              <div className="product-card-image">IMG</div>
              <div className="product-card-body">
                <div className="product-card-title">
                  <Link to="/market/product/bread-arabic">{'خبز عربي - 6 أرغفة'}</Link>
                </div>
                <div className="product-card-row">
                  <span className="product-price">{'AED ' + (4.25).toFixed(2)}</span>
                </div>
                <div className="delivery-note">Get it Today, 6 - 9 PM</div>
              </div>
            </div>
          </div>
          <div className="product-grid-item">
            <div className="product-card">
              <div className="product-card-image">IMG</div>
              <div className="product-card-body">
                <div className="product-card-title">
                  <Link to="/market/product/nescafe-gold">{'Nescafé Gold - 200g'}</Link>
                </div>
                <div className="product-card-row">
                  <span className="product-price">{'AED ' + (42.0).toFixed(2)}</span>
                </div>
                <div className="delivery-note">Get it Tomorrow</div>
              </div>
            </div>
          </div>
          <div className="product-grid-item">
            <div className="product-card">
              <div className="product-card-image">IMG</div>
              <div className="product-card-body">
                <div className="product-card-title">
                  <Link to="/market/product/water-al-ain">{'Al Ain Water - 24 x 500ml'}</Link>
                </div>
                <div className="product-card-row">
                  <span className="product-price">{'AED ' + (9.95).toFixed(2)}</span>
                </div>
                <div className="delivery-note">Get it Today, 6 - 9 PM</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
