import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

function Index() {
  return (
    <div>
      <h1>Mizan v0</h1>
      <ul>
        <li>
          <Link to="/market">Mizan Market</Link>
        </li>
        <li>
          <Link to="/move">Mizan Move</Link>
        </li>
      </ul>
    </div>
  )
}

function MarketPlaceholder() {
  return <div>Mizan Market</div>
}

function MovePlaceholder() {
  return <div>Mizan Move</div>
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
