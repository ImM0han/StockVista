import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStockStore } from '../store/useStockStore.js'
import StockCard from '../components/StockCard.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { fmt } from '../utils/format.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const INDICES = ['NIFTY 50', 'NIFTY Next 50', 'NIFTY Midcap', 'NIFTY Smallcap', 'NIFTY Microcap', 'All']
const SORTS   = [
  { k: 'default', l: 'Default' }, { k: 'price_d', l: 'Price ↓' }, { k: 'price_a', l: 'Price ↑' },
  { k: 'change_d', l: 'Top Gainers' }, { k: 'change_a', l: 'Top Losers' },
]

export default function Home() {
  const { quotes, wsConnected, lastUpdate } = useStockStore()
  const navigate = useNavigate()
  const [stocks, setStocks]             = useState([])
  const [sectors, setSectors]           = useState(['All'])
  const [activeIndex, setActiveIndex]   = useState('NIFTY 50')
  const [activeSector, setActiveSector] = useState('All')
  const [filter, setFilter]             = useState('All')
  const [sort, setSort]                 = useState('default')
  const [loading, setLoading]           = useState(true)
  const [view, setView]                 = useState('card') // 'card' | 'table'

  useEffect(() => {
    fetch(`${API_URL}/stocks/meta`).then(r => r.json())
      .then(d => setSectors(['All', ...(d.sectors || [])]))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const idx = activeIndex !== 'All' ? `index=${encodeURIComponent(activeIndex)}` : 'index=All'
    const sec = activeSector !== 'All' ? `&sector=${encodeURIComponent(activeSector)}` : ''
    fetch(`${API_URL}/stocks?${idx}${sec}&limit=200`)
      .then(r => r.json())
      .then(d => { setStocks(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [activeIndex, activeSector])

  const list = useMemo(() => {
    let l = stocks.map(s => ({ ...s, ...(quotes[s.symbol] || {}) }))
    if (filter === 'Gainers') l = l.filter(s => (s.change_pct ?? 0) > 0)
    if (filter === 'Losers')  l = l.filter(s => (s.change_pct ?? 0) < 0)
    if (sort === 'price_d')   l = [...l].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    if (sort === 'price_a')   l = [...l].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    if (sort === 'change_d')  l = [...l].sort((a, b) => (b.change_pct ?? -999) - (a.change_pct ?? -999))
    if (sort === 'change_a')  l = [...l].sort((a, b) => (a.change_pct ?? 999) - (b.change_pct ?? 999))
    return l
  }, [stocks, quotes, filter, sort])

  const stats = useMemo(() => {
    const loaded  = list.filter(s => s.price != null)
    const gainers = loaded.filter(s => s.change_pct > 0).length
    const losers  = loaded.filter(s => s.change_pct < 0).length
    const avgChg  = loaded.length ? loaded.reduce((a, s) => a + (s.change_pct ?? 0), 0) / loaded.length : 0
    return { loaded: loaded.length, total: list.length, gainers, losers, avgChg }
  }, [list])

  const prevQuotes = useRef({})
  useEffect(() => { prevQuotes.current = { ...quotes } }, [quotes])

  return (
    <div className="fade-in" style={{ maxWidth: 1440, margin: '0 auto', padding: '28px 24px' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>NSE India · Real-time</div>
          <h1 style={{ fontFamily: 'Figtree', fontWeight: 700, fontSize: 26, color: '#111118', letterSpacing: '-0.03em', margin: 0 }}>
            {activeIndex}
          </h1>
        </div>
        <SearchBar />
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { l: 'Tracking', v: list.length, clr: '#111118' },
          { l: 'Loaded',   v: `${stats.loaded}/${stats.total}`, clr: '#e91e8c' },
          { l: 'Gainers',  v: stats.gainers, clr: '#059669' },
          { l: 'Losers',   v: stats.losers,  clr: '#dc2626' },
          { l: 'Avg Δ',
            v: `${stats.avgChg >= 0 ? '+' : ''}${stats.avgChg.toFixed(2)}%`,
            clr: stats.avgChg >= 0 ? '#059669' : '#dc2626' },
        ].map(({ l, v, clr }) => (
          <div key={l} className="card" style={{ padding: '12px 16px' }}>
            <div className="label" style={{ marginBottom: 5 }}>{l}</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 18, fontWeight: 500, color: clr, letterSpacing: '-0.02em' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>

        {/* Index segment */}
        <div style={{ display: 'flex', gap: 2, background: '#f4f4f5', borderRadius: 10, padding: 3 }}>
          {INDICES.map(idx => (
            <button key={idx} onClick={() => setActiveIndex(idx)}
              className={`seg-btn ${activeIndex === idx ? 'active' : ''}`} style={{ fontSize: 11 }}>
              {idx}
            </button>
          ))}
        </div>

        <div className="divider" style={{ margin: '0 4px' }}/>

        {/* Filter pills */}
        {['All', 'Gainers', 'Losers'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`filter-pill ${filter === f ? 'active' : ''}`}>{f}</button>
        ))}

        <div className="divider" style={{ margin: '0 4px' }}/>

        {/* Sector */}
        <select value={activeSector} onChange={e => setActiveSector(e.target.value)} className="input-base" style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer', maxWidth: 150 }}>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Sort */}
        <select value={sort} onChange={e => setSort(e.target.value)} className="input-base" style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
          {SORTS.map(s => <option key={s.k} value={s.k}>{s.l}</option>)}
        </select>

        <div className="divider" style={{ margin: '0 4px' }}/>

        {/* View toggle */}
        <div style={{ display: 'flex', background: '#f4f4f5', borderRadius: 8, padding: 3, gap: 2 }}>
          {[['card', '⊞'], ['table', '☰']].map(([v, icon]) => (
            <button key={v} onClick={() => setView(v)} style={{
              width: 30, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
              background: view === v ? '#fff' : 'transparent',
              color: view === v ? '#e91e8c' : '#a1a1aa',
              boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.14s',
            }}>{icon}</button>
          ))}
        </div>

        {/* Live status */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: wsConnected ? '#e91e8c' : '#dc2626', animation: wsConnected ? 'livePulse 2s infinite' : 'none' }}/>
          <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#a1a1aa' }}>
            {wsConnected ? (lastUpdate ? fmt.time(lastUpdate) : 'LIVE') : 'RECONNECTING'}
          </span>
        </div>
      </div>

      {/* ── CARD VIEW ─────────────────────────────────────── */}
      {view === 'card' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {loading
            ? Array(20).fill(0).map((_, i) => <StockCard key={i} skeleton />)
            : list.map(s => <StockCard key={s.symbol} quote={quotes[s.symbol] || s} />)
          }
        </div>
      )}

      {/* ── TABLE VIEW ────────────────────────────────────── */}
      {view === 'table' && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Symbol', 'Name', 'LTP (₹)', '% Change', 'Volume', 'Mkt Cap', 'Sector'].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 2 && i <= 5 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(20).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(7).fill(0).map((_, j) => (
                      <td key={j}><div className="skel" style={{ height: 12, width: j === 1 ? 130 : 70 }}/></td>
                    ))}
                  </tr>
                ))
                : list.map(s => {
                  const q = quotes[s.symbol] || s
                  const isPos = (q.change_pct ?? 0) >= 0
                  return (
                    <tr key={s.symbol} className="clickable" onClick={() => navigate(`/stock/${s.symbol}`)}>
                      <td style={{ fontFamily: 'DM Mono', fontSize: 12, fontWeight: 500, color: '#e91e8c' }}>
                        {s.symbol?.replace('.NS', '')}
                      </td>
                      <td style={{ fontSize: 12, color: '#71717a', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.name}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontSize: 12, fontWeight: 500, color: '#111118' }}>
                        {q.price != null ? `₹${fmt.price(q.price)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontFamily: 'DM Mono', fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5, background: isPos ? '#ecfdf5' : '#fef2f2', color: isPos ? '#059669' : '#dc2626' }}>
                          {fmt.pct(q.change_pct)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontSize: 11, color: '#71717a' }}>{fmt.volume(q.volume)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontSize: 11, color: '#71717a' }}>{fmt.marketCap(q.market_cap)}</td>
                      <td>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: '#f4f4f5', color: '#71717a' }}>{q.sector}</span>
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
          {!loading && list.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: '#a1a1aa', fontFamily: 'Figtree' }}>No stocks match this filter</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 14, textAlign: 'right', fontFamily: 'DM Mono', fontSize: 10, color: '#000000' }}>
        {list.length} stocks · ₹ INR · NSE · Data may be delayed 15 min
      </div>
    </div>
  )
}
