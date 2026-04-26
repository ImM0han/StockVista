import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStockStore } from '../store/useStockStore.js'
import { fmt } from '../utils/format.js'

function useDebounce(v, d = 360) {
  const [dv, setDv] = useState(v)
  useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t) }, [v, d])
  return dv
}

export default function SearchBar() {
  const [q, setQ]       = useState('')
  const [open, setOpen] = useState(false)
  const dq = useDebounce(q, 360)
  const { searchResults, searchLoading, searchStock, clearSearch } = useStockStore()
  const navigate = useNavigate()
  const ref = useRef(null)

  useEffect(() => { dq.trim() ? searchStock(dq) : clearSearch() }, [dq])
  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const go = (sym) => { navigate(`/stock/${sym}`); setQ(''); clearSearch(); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative', width: 280 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#fff',
        border: `1px solid ${open ? '#e91e8c' : '#e8e8ec'}`,
        borderRadius: 9, padding: '7px 12px',
        boxShadow: open ? '0 0 0 3px rgba(233,30,140,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'all 0.15s ease',
      }}>
        {searchLoading
          ? <div style={{ width: 14, height: 14, border: '1.5px solid #e91e8c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }}/>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={open ? '#e91e8c' : '#a1a1aa'} strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
        }
        <input
          value={q}
          onChange={e => { setQ(e.target.value.toUpperCase()); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Enter' && q.trim()) go(q.trim()); if (e.key === 'Escape') { setQ(''); setOpen(false) } }}
          placeholder="Search NSE stocks…"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'Figtree', fontSize: 13.5, color: '#111118',
            caretColor: '#e91e8c',
          }}
        />
        {q && (
          <button onClick={() => { setQ(''); clearSearch() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', fontSize: 16, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {open && (searchResults.length > 0 || (q && !searchLoading)) && (
        <div className="slide-up" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: '#fff', border: '1px solid #e8e8ec', borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
          overflow: 'hidden', zIndex: 100,
        }}>
          {searchResults.length === 0 && q && !searchLoading && (
            <div style={{ padding: '12px 14px', color: '#a1a1aa', fontSize: 13, fontFamily: 'Figtree' }}>
              No results for "{q}"
            </div>
          )}
          {searchResults.map(r => (
            <button key={r.symbol} onClick={() => go(r.symbol)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: '1px solid #f4f4f5', textAlign: 'left', transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div>
                <div style={{ fontFamily: 'DM Mono', fontSize: 12, fontWeight: 500, color: '#e91e8c' }}>
                  {r.symbol?.replace('.NS', '')}
                </div>
                <div style={{ fontSize: 12, color: '#71717a', marginTop: 1 }}>
                  {r.meta?.name} · <span style={{ color: '#a1a1aa' }}>{r.meta?.sector}</span>
                </div>
              </div>
              {r.quote?.price != null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 13, fontWeight: 500, color: '#111118' }}>₹{fmt.price(r.quote.price)}</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: fmt.changeColor(r.quote.change_pct) }}>
                    {fmt.pct(r.quote.change_pct)}
                  </div>
                </div>
              )}
            </button>
          ))}
          <div style={{ padding: '6px 14px', background: '#fafafa', borderTop: '1px solid #f4f4f5' }}>
            <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#d4d4d8', letterSpacing: '0.04em' }}>
              ↵ to navigate · ESC to close
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
