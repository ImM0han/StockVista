import { create } from 'zustand'

const WS_URL  = import.meta.env.VITE_WS_URL  || 'ws://localhost:8000/ws/stocks'
const API_URL = import.meta.env.VITE_API_URL  || 'http://localhost:8000'

let ws = null, reconnectTimer = null

export const useStockStore = create((set, get) => ({
  quotes: {}, wsConnected: false, lastUpdate: null,
  stockDetail: null, detailLoading: false, detailError: null,
  searchResults: [], searchLoading: false,
  activeDuration: '6M',

  connectWebSocket: () => {
    if (ws && ws.readyState < 2) return
    ws = new WebSocket(WS_URL)
    ws.onopen = () => {
      set({ wsConnected: true })
      ws._ping = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'ping' })), 30000)
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'quotes') {
          const m = {}
          for (const q of msg.data) if (q.symbol) m[q.symbol] = q
          set(s => ({ quotes: { ...s.quotes, ...m }, lastUpdate: new Date() }))
        }
      } catch {}
    }
    ws.onerror = () => set({ wsConnected: false })
    ws.onclose = () => {
      clearInterval(ws._ping)
      set({ wsConnected: false })
      reconnectTimer = setTimeout(() => get().connectWebSocket(), 3000)
    }
  },

  disconnectWebSocket: () => {
    clearTimeout(reconnectTimer)
    if (ws) { clearInterval(ws._ping); ws.close(); ws = null }
    set({ wsConnected: false })
  },

  fetchStockDetail: async (symbol, duration = '6M') => {
    set({ detailLoading: true, detailError: null, activeDuration: duration })
    try {
      const res = await fetch(`${API_URL}/stock/${symbol}?duration=${duration}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      set({ stockDetail: await res.json(), detailLoading: false })
    } catch (e) {
      set({ detailError: e.message, detailLoading: false })
    }
  },

  searchStock: async (q) => {
    if (!q.trim()) return set({ searchResults: [] })
    set({ searchLoading: true })
    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      set({ searchResults: data.results || [], searchLoading: false })
    } catch { set({ searchResults: [], searchLoading: false }) }
  },

  clearSearch: () => set({ searchResults: [] }),
}))
