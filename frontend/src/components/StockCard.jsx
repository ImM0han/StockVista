import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmt } from '../utils/format.js'

export default function StockCard({ quote: q, skeleton }) {
  const navigate = useNavigate()
  const prevRef  = useRef(null)
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    if (!q?.price || prevRef.current == null) { prevRef.current = q?.price; return }
    if (q.price !== prevRef.current) {
      setFlash(q.price > prevRef.current ? 'up' : 'down')
      prevRef.current = q.price
      const t = setTimeout(() => setFlash(null), 700)
      return () => clearTimeout(t)
    }
  }, [q?.price])

  if (skeleton) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div><div className="skel" style={{ width: 56, height: 13, marginBottom: 6 }}/><div className="skel" style={{ width: 110, height: 11 }}/></div>
          <div className="skel" style={{ width: 44, height: 22, borderRadius: 6 }}/>
        </div>
        <div className="skel" style={{ width: 88, height: 28, marginBottom: 16 }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="skel" style={{ width: 60, height: 10 }}/>
          <div className="skel" style={{ width: 55, height: 10 }}/>
        </div>
      </div>
    )
  }

  const isPos   = (q?.change_pct ?? 0) >= 0
  const clrMain = isPos ? '#059669' : '#dc2626'
  const clrBg   = isPos ? '#ecfdf5' : '#fef2f2'

  return (
    <div
      className={`card card-interactive ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`}
      onClick={() => navigate(`/stock/${q.symbol}`)}
      style={{ padding: 18, position: 'relative', overflow: 'hidden', userSelect: 'none' }}
    >
      {/* Accent stripe top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent 0%, ${clrMain}40 30%, ${clrMain}40 70%, transparent 100%)`,
      }}/>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: 13, fontWeight: 500, color: '#111118', letterSpacing: '-0.01em' }}>
            {q.symbol?.replace('.NS', '')}
          </div>
          <div style={{ fontSize: 11.5, color: '#a1a1aa', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
            {q.name}
          </div>
        </div>
        <div style={{
          fontFamily: 'DM Mono', fontSize: 11, fontWeight: 500,
          padding: '3px 8px', borderRadius: 6,
          background: clrBg, color: clrMain,
          border: `1px solid ${clrMain}22`,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {fmt.pct(q.change_pct)}
        </div>
      </div>

      {/* Price */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#a1a1aa' }}>₹</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 500, color: '#111118', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {q.price != null ? fmt.price(q.price) : <span style={{ color: '#d4d4d8', fontSize: 16 }}>—</span>}
          </span>
        </div>
        {q.change != null && (
          <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: clrMain, marginTop: 3 }}>
            {q.change >= 0 ? '▲' : '▼'} ₹{fmt.price(Math.abs(q.change))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#a1a1aa' }}>
          Vol <span style={{ fontFamily: 'DM Mono', color: '#71717a' }}>{fmt.volume(q.volume)}</span>
        </div>
        {q.sector && (
          <div style={{
            fontSize: 10.5, padding: '2px 7px', borderRadius: 5,
            background: '#f4f4f5', color: '#71717a', fontWeight: 500,
          }}>
            {q.sector}
          </div>
        )}
      </div>
    </div>
  )
}
