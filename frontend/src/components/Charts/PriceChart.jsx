import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine, Brush, Cell,
} from 'recharts'
import { fmt } from '../../utils/format.js'

const SYNC = 'stockChart'
const A = '#e91e8c'

/* ── Custom Candlestick Shape ────────────────────────────── */
const CandleBar = (props) => {
  const { x, y, width, payload } = props
  if (!payload?.open || !payload?.close || !payload?.high || !payload?.low) return null
  const { open, close, high, low, yScale } = payload
  if (!yScale) return null

  const isGreen = close >= open
  const color   = isGreen ? '#059669' : '#dc2626'
  const bodyTop    = yScale(Math.max(open, close))
  const bodyBottom = yScale(Math.min(open, close))
  const wickTop    = yScale(high)
  const wickBottom = yScale(low)
  const bodyH      = Math.max(1, bodyBottom - bodyTop)
  const cx         = x + width / 2

  return (
    <g>
      {/* Upper wick */}
      <line x1={cx} y1={wickTop} x2={cx} y2={bodyTop} stroke={color} strokeWidth={1.5}/>
      {/* Body */}
      <rect x={x + 1} y={bodyTop} width={Math.max(1, width - 2)} height={bodyH} fill={color} fillOpacity={0.85} rx={1}/>
      {/* Lower wick */}
      <line x1={cx} y1={bodyBottom} x2={cx} y2={wickBottom} stroke={color} strokeWidth={1.5}/>
    </g>
  )
}

/* ── Tooltip ─────────────────────────────────────────────── */
const Tip = ({ active, payload, label, mode }) => {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  return (
    <div style={{ background:'#fff', border:'1px solid #e8e8ec', borderRadius:10, padding:'10px 14px', boxShadow:'0 8px 30px rgba(0,0,0,0.1)', fontFamily:'DM Mono', fontSize:11, minWidth:160 }}>
      <div style={{ color:'#a1a1aa', marginBottom:7, fontFamily:'Figtree', fontSize:11, fontWeight:600 }}>{label}</div>
      {mode === 'candle' && p?.open != null ? (
        <>
          {[['Open',p.open],['High',p.high],['Low',p.low],['Close',p.close]].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', gap:16, marginBottom:3 }}>
              <span style={{ color:'#a1a1aa' }}>{l}</span>
              <span style={{ color:'#111118', fontWeight:600 }}>₹{fmt.price(v)}</span>
            </div>
          ))}
          <div style={{ borderTop:'1px solid #f0f0f0', marginTop:5, paddingTop:5 }}>
            <span style={{ color: p.close >= p.open ? '#059669' : '#dc2626', fontWeight:700 }}>
              {p.close >= p.open ? '▲' : '▼'} {Math.abs(((p.close-p.open)/p.open)*100).toFixed(2)}%
            </span>
          </div>
        </>
      ) : (
        payload.filter(x => x.value != null && x.dataKey !== 'ohlc').map(x => (
          <div key={x.dataKey} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:x.color, flexShrink:0 }}/>
            <span style={{ color:'#71717a' }}>{x.name}:</span>
            <span style={{ color:'#111118', fontWeight:500 }}>₹{fmt.price(x.value)}</span>
          </div>
        ))
      )}
    </div>
  )
}

export default function PriceChart({ indicators, quote, duration, historyData }) {
  const [mode, setMode]       = useState('line') // 'line' | 'candle'
  const [showBB, setShowBB]   = useState(true)
  const [showMA, setShowMA]   = useState(true)

  const isIntra = duration === '1W'

  /* Build OHLC map from history for candlestick */
  const ohlcMap = useMemo(() => {
    const map = {}
    if (!historyData?.data) return map
    for (const row of historyData.data) {
      const label = isIntra ? fmt.shortDateTime(row.date) : fmt.shortDate(row.date)
      map[label] = { open: row.open, high: row.high, low: row.low, close: row.close }
    }
    return map
  }, [historyData, isIntra])

  const data = useMemo(() => {
    if (!indicators?.dates) return []
    return indicators.dates.map((d, i) => {
      const label = isIntra ? fmt.shortDateTime(d) : fmt.shortDate(d)
      const ohlc  = ohlcMap[label] || {}
      return {
        date:     label,
        close:    indicators.close?.[i]    ?? null,
        ma_short: indicators.ma_short?.[i] ?? null,
        ma_long:  indicators.ma_long?.[i]  ?? null,
        bb_upper: indicators.bb_upper?.[i] ?? null,
        bb_lower: indicators.bb_lower?.[i] ?? null,
        open:  ohlc.open  ?? indicators.close?.[i] ?? null,
        high:  ohlc.high  ?? indicators.close?.[i] ?? null,
        low:   ohlc.low   ?? indicators.close?.[i] ?? null,
      }
    })
  }, [indicators, duration, ohlcMap])

  if (!data.length) return (
    <div style={{ height:280, display:'flex', alignItems:'center', justifyContent:'center', color:'#a1a1aa', fontFamily:'Figtree', fontSize:13 }}>
      No data available
    </div>
  )

  const ti = Math.max(1, Math.floor(data.length / 7))
  const labels = { '1W':['EMA9','EMA21'], '1M':['EMA10','EMA30'], '6M':['EMA50','EMA100'], '1Y':['EMA13w','EMA26w'] }
  const [sl, ll] = labels[duration] || ['MA Short','MA Long']
  const ax = { fill:'#a1a1aa', fontSize:10, fontFamily:'DM Mono' }

  /* Give each data point its yScale for the custom candle shape */
  const withScale = (props) => ({ ...props, payload: { ...props.payload, yScale: props.yAxis?.scale } })

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 4px 10px', flexWrap:'wrap' }}>
        {/* Chart type toggle */}
        <div style={{ display:'flex', background:'#f4f4f5', borderRadius:7, padding:2, gap:1 }}>
          {[['line','📈 Line'],['candle','🕯 Candle']].map(([k,l]) => (
            <button key={k} onClick={() => setMode(k)} style={{
              fontFamily:'Figtree', fontSize:11, fontWeight:600,
              padding:'4px 10px', borderRadius:5, border:'none', cursor:'pointer', transition:'all 0.14s',
              background: mode===k ? A : 'transparent',
              color: mode===k ? '#fff' : '#71717a',
            }}>{l}</button>
          ))}
        </div>

        <div style={{ width:1, height:18, background:'#e8e8ec' }}/>

        {/* Overlay toggles */}
        {[
          { key:'ma', label:'Moving Avgs', val:showMA, set:setShowMA, color:'#f59e0b' },
          { key:'bb', label:'Bollinger',   val:showBB, set:setShowBB, color:'#e91e8c' },
        ].map(({ key, label, val, set, color }) => (
          <button key={key} onClick={() => set(v => !v)} style={{
            fontFamily:'Figtree', fontSize:11, fontWeight:500,
            padding:'4px 10px', borderRadius:6, border:`1px solid ${val ? color+'44' : '#e8e8ec'}`,
            background: val ? color+'12' : 'transparent',
            color: val ? color : '#a1a1aa',
            cursor:'pointer', transition:'all 0.14s', display:'flex', alignItems:'center', gap:5,
          }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background: val ? color : '#d4d4d8', display:'inline-block' }}/>
            {label}
          </button>
        ))}

        <span style={{ fontFamily:'DM Mono', fontSize:9, color:'#a1a1aa', marginLeft:'auto' }}>
          Drag the bar below to zoom
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top:4, right:12, left:12, bottom:4 }} syncId={SYNC}>
          <CartesianGrid strokeDasharray="2 4" stroke="#f0f0f0" vertical={false}/>
          <XAxis dataKey="date" tick={ax} tickLine={false} axisLine={false} interval={ti}/>
          <YAxis domain={['auto','auto']} tick={ax} tickLine={false} axisLine={false} width={70}
            tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0)}`}/>
          <Tooltip content={<Tip mode={mode}/>}/>

          {/* Bollinger Bands */}
          {showBB && <>
            <Line type="monotone" dataKey="bb_upper" name="BB+" stroke={A} strokeWidth={1} dot={false} strokeDasharray="3 3" strokeOpacity={0.4} legendType="none"/>
            <Line type="monotone" dataKey="bb_lower" name="BB-" stroke={A} strokeWidth={1} dot={false} strokeDasharray="3 3" strokeOpacity={0.4} legendType="none"/>
          </>}

          {/* Moving Averages */}
          {showMA && <>
            <Line type="monotone" dataKey="ma_short" name={sl} stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeOpacity={0.9}/>
            <Line type="monotone" dataKey="ma_long"  name={ll} stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeOpacity={0.9}/>
          </>}

          {/* Price — line or candle */}
          {mode === 'line' ? (
            <Line type="monotone" dataKey="close" name="Price" stroke={A} strokeWidth={2.5} dot={false}
              activeDot={{ r:4, fill:A, stroke:'#fff', strokeWidth:2 }}/>
          ) : (
            <Bar dataKey="close" name="Price" shape={(props) => <CandleBar {...props} payload={{ ...props.payload, yScale: null }} />}
              legendType="none" isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={(d.close??0) >= (d.open??0) ? '#05966920' : '#dc262620'}/>
              ))}
            </Bar>
          )}

          {quote?.price && <ReferenceLine y={quote.price} stroke={A} strokeDasharray="4 4" strokeOpacity={0.3}/>}

          {/* Brush — zoom control */}
          <Brush
            dataKey="date"
            height={24}
            stroke="#e8e8ec"
            fill="#fafafa"
            travellerWidth={6}
            startIndex={Math.max(0, data.length - Math.min(data.length, 60))}
            tickFormatter={() => ''}
          >
            <ComposedChart>
              <Line type="monotone" dataKey="close" stroke={A} strokeWidth={1} dot={false}/>
            </ComposedChart>
          </Brush>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Candle legend */}
      {mode === 'candle' && (
        <div style={{ display:'flex', gap:14, padding:'6px 12px 0', fontFamily:'DM Mono', fontSize:9, color:'#a1a1aa' }}>
          <span><span style={{ color:'#059669', fontWeight:700 }}>█</span> Bullish (close &gt; open)</span>
          <span><span style={{ color:'#dc2626', fontWeight:700 }}>█</span> Bearish (close &lt; open)</span>
        </div>
      )}
    </div>
  )
}
