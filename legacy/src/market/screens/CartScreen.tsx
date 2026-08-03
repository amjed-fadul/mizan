import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../market.css'
import Price from '../Price'
import PrimaryButton from '../PrimaryButton'
import ActionButton from '../../move/ActionButton'

const INITIAL_LINES = [
  {
    id: 'milk-2l',
    name: 'حليب طازج كامل الدسم',
    size: '2 لتر',
    price: 11.5,
    wasPrice: 13.0,
    quantity: 2
  },
  {
    id: 'nescafe-gold',
    name: 'Nescafé Gold',
    size: '200g',
    price: 42.0,
    quantity: 1
  },
  {
    id: 'rice-basmati',
    name: 'أرز بسمتي',
    size: '5 كجم',
    price: 34.75,
    wasPrice: 39.0,
    quantity: 1
  },
  {
    id: 'water-al-ain',
    name: 'Al Ain Water',
    size: '24 x 500ml',
    price: 9.95,
    quantity: 3
  }
]

const DELIVERY_FEE = 12.0
const VAT_RATE = 0.05

export default function CartScreen() {
  const navigate = useNavigate()
  const [lines, setLines] = useState(INITIAL_LINES)

  const changeQuantity = (id, delta) => {
    setLines(
      lines.map((line) => {
        if (line.id !== id) {
          return line
        }
        const next = line.quantity + delta
        if (next < 1) {
          return line
        }
        return { ...line, quantity: next }
      })
    )
  }

  const removeLine = (id) => {
    setLines(lines.filter((line) => line.id !== id))
  }

  let subtotal = 0
  lines.forEach((line) => {
    subtotal = subtotal + line.price * line.quantity
  })

  const vat = subtotal * VAT_RATE
  const total = subtotal + DELIVERY_FEE + vat

  return (
    <div className="container">
      <div className="mk-screen-nav">
        <Link to="/">Home</Link> | <Link to="/market">Grocery</Link> |{' '}
        <Link to="/market/cart">Cart</Link> | <Link to="/move">Mizan Move</Link>
      </div>

      <h1>Your Cart</h1>
      <p className="muted">{lines.length + ' items ready for delivery to Jumeirah 1, Dubai'}</p>

      <div className="mk-cart">
        <div className="mk-cart__lines">
          {lines.map((line) => (
            <div className="mk-cart__line" key={line.id}>
              <div className="mk-cart__line-media">Image</div>
              <div className="mk-cart__line-body">
                <div className="mk-cart__line-title">{line.name + ' - ' + line.size}</div>
                <div className="mk-cart__line-meta">
                  {'AED ' + line.price.toFixed(2) + ' each'}
                </div>
                <Price
                  amount={line.price * line.quantity}
                  wasAmount={line.wasPrice ? line.wasPrice * line.quantity : undefined}
                  size="sm"
                />
                <div className="mk-cart__qty">
                  <PrimaryButton
                    variant="secondary"
                    size="sm"
                    onClick={() => changeQuantity(line.id, -1)}
                  >
                    -
                  </PrimaryButton>
                  <span className="mk-cart__qty-value">{line.quantity}</span>
                  <PrimaryButton
                    variant="secondary"
                    size="sm"
                    onClick={() => changeQuantity(line.id, 1)}
                  >
                    +
                  </PrimaryButton>
                  <PrimaryButton variant="ghost" size="sm" onClick={() => removeLine(line.id)}>
                    Remove
                  </PrimaryButton>
                </div>
              </div>
            </div>
          ))}

          <div className="mk-cart__promo">
            <ActionButton kind="ghost">Apply Promo Code</ActionButton>
          </div>
        </div>

        <div className="mk-cart__summary">
          <div className="mk-card">
            <div className="mk-card__title">Order Summary</div>
            <div className="mk-cart__summary-row">
              <span>Subtotal</span>
              <span>{'AED ' + subtotal.toFixed(2)}</span>
            </div>
            <div className="mk-cart__summary-row">
              <span>Delivery</span>
              <span>{'AED ' + DELIVERY_FEE.toFixed(2)}</span>
            </div>
            <div className="mk-cart__summary-row">
              <span>VAT (5%)</span>
              <span>{'AED ' + vat.toFixed(2)}</span>
            </div>
            <div className="mk-cart__summary-total">
              <span>Total</span>
              <span>{'AED ' + total.toFixed(2)}</span>
            </div>
            <div className="mk-delivery">Delivery slot: Today, 6 - 9 PM</div>
            <div className="mk-card__footer">
              <PrimaryButton size="lg" fullWidth={true}>
                Checkout
              </PrimaryButton>
              <PrimaryButton
                variant="secondary"
                size="md"
                fullWidth={true}
                onClick={() => navigate('/market')}
              >
                Continue Shopping
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
