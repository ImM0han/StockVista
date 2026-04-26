import React, { useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Brush } from 'recharts'
import { fmt } from '../../utils/format.js'

const SYNC = 'stockChart'

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const rsi = payload[0]?.value
  const zone = rsi < 30 ? 'OVERSOLD — good time to consider buying' : rsi > 70 ? 'OVERBOUGHT — consider taking profits' : 'NEUTRAL — no strong signal'
  const c = rsi < 30 ? '#059669' : rsi > 70 ? '#dc2626' : '#e91e8c'
  return (
    <div style={{ background:'#fff', border:'1px solid #e8e8ec', borderRadius:10, padding:'10px 14px', boxShadow:'0 8px 30px rgba(0,0,0,0.1)', fontFamily:'DM Mono', fontSize:11, maxWidth:220 }}>
      <div style={{ color:'#a1a1aa', marginBottom:4, fontFamily:'Figtree', fontSize:11 }}>{label}</div>
      <div style={{ color:c, fontWeight:700, fontSize:13 }}>RSI {rsi?.toFixed(2)}</div>
      <div style={{ color:'#71717a', fontSize:10, marginTop:3 }}>{zone}</div>
    </div>
  )
}

export default function RSIChart({ indicators, duration }) {
  const isIntra = duration === '1W'
  const data = useMemo(() => {
    if (!indicators?.dates || !indicators?.rsi) return []
    return indicators.dates.map((d, i) => ({
      date: isIntra ? fmt.shortDateTime(d) : fmt.shortDate(d),
      rsi:  indicators.rsi[i] ?? null,
    }))
  }, [indicators, duration])

  if (!data.length) return null
  const last = data[data.length - 1]?.rsi
  const c = last < 30 ? '#059669' : last > 70 ? '#dc2626' : '#e91e8c'
  const period = duration === '1W' ? 7 : duration === '1Y' ? 21 : 14
  const ti = Math.max(1, Math.floor(data.length / 7))
  const ax = { fill:'#a1a1aa', fontSize:10, fontFamily:'DM Mono' }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 10px 8px', flexWrap:'wrap' }}>
        <span style={{ fontFamily:'DM Mono', fontSize:10, color:'#a1a1aa' }}>RSI({period})</span>
        {last != null && (
          <span style={{ fontFamily:'DM Mono', fontSize:11, fontWeight:700, color:c,
            background: last<30?'#ecfdf5':last>70?'#fef2f2':'#fdf2f8',
            border:`1px solid ${c}25`, padding:'2px 10px', borderRadius:6 }}>
            {last.toFixed(2)} — {last<30?'OVERSOLD':last>70?'OVERBOUGHT':'NEUTRAL'}
          </span>
        )}
        <span style={{ fontFamily:'DM Mono', fontSize:9, color:'#a1a1aa', marginLeft:'auto' }}>Zoom synced</span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={data} margin={{ top:4, right:12, left:12, bottom:4 }} syncId={SYNC}>
          <defs>
            <linearGradient id="rsiGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity="0.2"/>
              <stop offset="100%" stopColor={c} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#f0f0f0" vertical={false}/>
          <XAxis dataKey="date" tick={ax} tickLine={false} axisLine={false} interval={ti}/>
          <YAxis domain={[0,100]} ticks={[0,30,50,70,100]} tick={ax} tickLine={false} axisLine={false} width={28}/>
          <Tooltip content={<Tip/>}/>
          {/* Zone labels */}
          <ReferenceLine y={70} stroke="#dc2626" strokeDasharray="3 3" strokeOpacity={0.4} label={{ value:'70', position:'right', fontSize:9, fill:'#dc2626' }}/>
          <ReferenceLine y={30} stroke="#059669" strokeDasharray="3 3" strokeOpacity={0.4} label={{ value:'30', position:'right', fontSize:9, fill:'#059669' }}/>
          <Area type="monotone" dataKey="rsi" stroke={c} strokeWidth={2} fill="url(#rsiGrad)" dot={false}
            activeDot={{ r:4, fill:c, stroke:'#fff', strokeWidth:2 }}/>
          <Brush dataKey="date" height={22} stroke="#e8e8ec" fill="#fafafa" travellerWidth={6}
            startIndex={Math.max(0, data.length - Math.min(data.length, 60))} tickFormatter={() => ''}/>
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display:'flex', gap:16, padding:'4px 12px 0', fontFamily:'DM Mono', fontSize:9, color:'#a1a1aa' }}>
        <span style={{ color:'rgba(5,150,105,0.7)' }}>━━ Below 30 = Stock is cheap (possible buy)</span>
        <span style={{ color:'rgba(220,38,38,0.7)' }}>━━ Above 70 = Stock is expensive (possible sell)</span>
      </div>
    </div>
  )
}
