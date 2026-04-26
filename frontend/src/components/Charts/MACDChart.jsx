import React, { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Brush } from 'recharts'
import { fmt } from '../../utils/format.js'

const SYNC = 'stockChart'

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const macd   = payload.find(p => p.dataKey === 'macd')?.value
  const signal = payload.find(p => p.dataKey === 'signal')?.value
  const cross  = macd != null && signal != null
    ? macd > signal ? '📈 MACD above signal — bullish momentum' : '📉 MACD below signal — bearish momentum'
    : ''
  return (
    <div style={{ background:'#fff', border:'1px solid #e8e8ec', borderRadius:10, padding:'10px 14px', boxShadow:'0 8px 30px rgba(0,0,0,0.1)', fontFamily:'DM Mono', fontSize:11, maxWidth:240 }}>
      <div style={{ color:'#a1a1aa', marginBottom:5, fontFamily:'Figtree', fontSize:11 }}>{label}</div>
      {payload.filter(p => p.value != null).map(p => (
        <div key={p.dataKey} style={{ display:'flex', gap:8, marginBottom:2, alignItems:'center' }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:p.color, flexShrink:0 }}/>
          <span style={{ color:'#71717a' }}>{p.name}:</span>
          <span style={{ color:'#111118', fontWeight:500 }}>{Number(p.value).toFixed(4)}</span>
        </div>
      ))}
      {cross && <div style={{ color:'#71717a', fontSize:10, marginTop:5, borderTop:'1px solid #f0f0f0', paddingTop:5 }}>{cross}</div>}
    </div>
  )
}

export default function MACDChart({ indicators, duration }) {
  const isIntra = duration === '1W'
  const data = useMemo(() => {
    if (!indicators?.dates || !indicators?.macd) return []
    return indicators.dates.map((d, i) => ({
      date:   isIntra ? fmt.shortDateTime(d) : fmt.shortDate(d),
      macd:   indicators.macd?.[i]        ?? null,
      signal: indicators.macd_signal?.[i] ?? null,
      hist:   indicators.macd_diff?.[i]   ?? null,
    }))
  }, [indicators, duration])

  if (!data.length) return null
  const last  = data[data.length - 1]
  const cross = last?.macd != null && last?.signal != null
    ? (last.macd > last.signal ? 'BULLISH' : 'BEARISH') : null
  const ti = Math.max(1, Math.floor(data.length / 7))
  const ax = { fill:'#a1a1aa', fontSize:10, fontFamily:'DM Mono' }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 10px 8px', flexWrap:'wrap' }}>
        <span style={{ fontFamily:'DM Mono', fontSize:10, color:'#a1a1aa' }}>MACD</span>
        {cross && (
          <span style={{ fontFamily:'DM Mono', fontSize:10, fontWeight:700, padding:'2px 10px', borderRadius:6,
            color: cross==='BULLISH'?'#059669':'#dc2626',
            background: cross==='BULLISH'?'#ecfdf5':'#fef2f2',
            border:`1px solid ${cross==='BULLISH'?'rgba(5,150,105,0.25)':'rgba(220,38,38,0.25)'}` }}>
            {cross==='BULLISH'?'📈':'📉'} {cross}
          </span>
        )}
        <span style={{ fontFamily:'DM Mono', fontSize:9, color:'#a1a1aa', marginLeft:'auto' }}>Zoom synced</span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={data} margin={{ top:4, right:12, left:12, bottom:4 }} syncId={SYNC}>
          <CartesianGrid strokeDasharray="2 4" stroke="#f0f0f0" vertical={false}/>
          <XAxis dataKey="date" tick={ax} tickLine={false} axisLine={false} interval={ti}/>
          <YAxis tick={ax} tickLine={false} axisLine={false} width={52} tickFormatter={v => v.toFixed(2)}/>
          <Tooltip content={<Tip/>}/>
          <ReferenceLine y={0} stroke="#e8e8ec" strokeWidth={1.5}/>
          <Bar dataKey="hist" name="Momentum" radius={[2,2,0,0]}>
            {data.map((d, i) => <Cell key={i} fill={d.hist >= 0 ? 'rgba(5,150,105,0.45)' : 'rgba(220,38,38,0.45)'}/>)}
          </Bar>
          <Line type="monotone" dataKey="macd"   name="MACD"   stroke="#e91e8c" strokeWidth={2}   dot={false}/>
          <Line type="monotone" dataKey="signal" name="Signal" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>
          <Brush dataKey="date" height={22} stroke="#e8e8ec" fill="#fafafa" travellerWidth={6}
            startIndex={Math.max(0, data.length - Math.min(data.length, 60))} tickFormatter={() => ''}/>
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ display:'flex', gap:16, padding:'4px 12px 0', fontFamily:'DM Mono', fontSize:9, color:'#a1a1aa' }}>
        <span>🟢 Green bars = buying momentum growing</span>
        <span>🔴 Red bars = selling momentum growing</span>
      </div>
    </div>
  )
}
