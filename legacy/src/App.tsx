import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import Button from './shared/Button'
import CategoryScreen from './market/screens/CategoryScreen'
import ProductDetailScreen from './market/screens/ProductDetailScreen'
import CartScreen from './market/screens/CartScreen'
import BookingScreen from './move/screens/BookingScreen'
import TripScreen from './move/screens/TripScreen'

function Index() {
  const navigate = useNavigate()

  return (
    <div className="container">
      <h1>Mizan v0</h1>
      <p className="muted">Internal build. Two products, one stylesheet.</p>
      <ul>
        <li>
          <Link to="/market">Mizan Market</Link>
        </li>
        <li>
          <Link to="/market/product/milk-2l">Mizan Market — Product</Link>
        </li>
        <li>
          <Link to="/market/cart">Mizan Market — Cart</Link>
        </li>
        <li>
          <Link to="/move">Mizan Move</Link>
        </li>
        <li>
          <Link to="/move/trip">Mizan Move — Trip</Link>
        </li>
      </ul>
      <div>
        <Button onClick={() => navigate('/market')}>Open Market</Button>
        <Button type="secondary" onClick={() => navigate('/move')}>
          Open Move
        </Button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/market">
          <Route index element={<CategoryScreen />} />
          <Route path="product/:id" element={<ProductDetailScreen />} />
          <Route path="cart" element={<CartScreen />} />
          <Route path="*" element={<CategoryScreen />} />
        </Route>
        <Route path="/move">
          <Route index element={<BookingScreen />} />
          <Route path="trip" element={<TripScreen />} />
          <Route path="*" element={<BookingScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
