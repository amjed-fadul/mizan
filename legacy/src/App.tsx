import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import Button from './shared/Button'

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
          <Link to="/move">Mizan Move</Link>
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

function MarketPlaceholder() {
  const navigate = useNavigate()

  return (
    <div className="container">
      <h1>Mizan Market</h1>
      <p className="muted">Screens coming soon.</p>
      <Button type="secondary" onClick={() => navigate('/')}>
        Back
      </Button>
    </div>
  )
}

function MovePlaceholder() {
  const navigate = useNavigate()

  return (
    <div className="container">
      <h1>Mizan Move</h1>
      <p className="muted">Screens coming soon.</p>
      <Button type="secondary" onClick={() => navigate('/')}>
        Back
      </Button>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/market">
          <Route index element={<MarketPlaceholder />} />
          <Route path="*" element={<MarketPlaceholder />} />
        </Route>
        <Route path="/move">
          <Route index element={<MovePlaceholder />} />
          <Route path="*" element={<MovePlaceholder />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
