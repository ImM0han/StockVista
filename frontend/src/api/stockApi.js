const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

export const api = {
  getStocks:  (index = 'NIFTY 50', sector = 'All', limit = 100) =>
    get(`/stocks?index=${encodeURIComponent(index)}&sector=${encodeURIComponent(sector)}&limit=${limit}`),
  getMeta:    () => get('/stocks/meta'),
  getStock:   (symbol, duration = '6M') =>
    get(`/stock/${encodeURIComponent(symbol)}?duration=${duration}`),
  getSignal:  (symbol, duration = '6M') =>
    get(`/signal/${encodeURIComponent(symbol)}?duration=${duration}`),
  search:     (q) => get(`/search?q=${encodeURIComponent(q)}`),
  health:     () => get('/health'),
}
