import React, { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Brush } from 'recharts'
import { fmt } from '../../utils/format.js'

const SYNC = 'stockChart'

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #e8e8ec', borderRadius:10, padding:'10px 14px', boxShadow:'0 8px 30px rgba(0,0,0,0.1)', fontFamily:'DM Mono', fontSize:11 }}>
      <div style={{ color:'#a1a1aa', marginBottom:5, fontFamily:'Figtree', fontSize:11 }}>{label}</div>
      {payload.filter(p => p.value != null).map(p => (
        <div key={p.dataKey} style={{ display:'flex', gap:8, marginBottom:2 }}>
          <span style={{ color:'#71717a' }}>{p.name}:</span>
          <span style={{ color:'#111118', fontWeight:500 }}>{fmt.volume(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function VolumeChart({ indicators, duration }) {
  const isIntra = duration === '1W'
  const data = useMemo(() => {
    if (!indicators?.dates) return []
    const cl = indicators.close || []
    return indicators.dates.map((d, i) => ({
      date:   isIntra ? fmt.shortDateTime(d) : fmt.shortDate(d),
      volume: indicators.volume?.[i]     ?? null,
      sma:    indicators.volume_sma?.[i] ?? null,
      up:     (cl[i] ?? 0) >= (cl[i-1] ?? cl[i] ?? 0),
    }))
  }, [indicators, duration])

  if (!data.length) return null
  const ti = Math.max(1, Math.floor(data.length / 7))
  const ax = { fill:'#a1a1aa', fontSize:10, fontFamily:'DM Mono' }

  return (
    <div>
      <div style={{ padding:'0 4px 10px' }}>
        <span style={{ fontFamily:'DM Mono', fontSize:9, color:'#a1a1aa' }}>
          Zoom synced with Price chart · drag the slider below
        </span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={data} margin={{ top:4, right:12, left:12, bottom:4 }} syncId={SYNC}>
          <CartesianGrid strokeDasharray="2 4" stroke="#f0f0f0" vertical={false}/>
          <XAxis dataKey="date" tick={ax} tickLine={false} axisLine={false} interval={ti}/>
          <YAxis tick={ax} tickLine={false} axisLine={false} width={58} tickFormatter={v => fmt.volume(v)}/>
          <Tooltip content={<Tip/>}/>
          <Bar dataKey="volume" name="Volume" radius={[2,2,0,0]}>
            {data.map((d, i) => <Cell key={i} fill={d.up ? 'rgba(5,150,105,0.5)' : 'rgba(220,38,38,0.5)'}/>)}
          </Bar>
          <Line type="monotone" dataKey="sma" name="Vol Avg" stroke="#e91e8c" strokeWidth={1.5} dot={false} strokeOpacity={0.8}/>
          <Brush dataKey="date" height={22} stroke="#e8e8ec" fill="#fafafa" travellerWidth={6}
            startIndex={Math.max(0, data.length - Math.min(data.length, 60))} tickFormatter={() => ''}/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
