import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #e8e8ec', borderRadius:8, padding:'6px 10px', boxShadow:'0 4px 16px rgba(0,0,0,0.1)', fontFamily:'DM Mono', fontSize:11 }}>
      <span style={{ color:payload[0].payload.color, fontWeight:600 }}>{payload[0].name}: {payload[0].value}%</span>
    </div>
  )
}

export default function SignalPieChart({ pie }) {
  if (!pie) return null
  const { buy_pct=0, hold_pct=0, sell_pct=0 } = pie
  const data = [
    { name:'BUY',  value:buy_pct,  color:'#059669' },
    { name:'HOLD', value:hold_pct, color:'#d97706' },
    { name:'SELL', value:sell_pct, color:'#dc2626' },
  ].filter(d => d.value > 0)
  const dom = [...data].sort((a,b) => b.value - a.value)[0]

  return (
    <div>
      <div style={{ position:'relative', display:'flex', justifyContent:'center', marginBottom:14 }}>
        <ResponsiveContainer width={130} height={130}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={3} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={2} stroke="#fff">
              {data.map((d,i) => <Cell key={i} fill={d.color} fillOpacity={0.9}/>)}
            </Pie>
            <Tooltip content={<Tip/>}/>
          </PieChart>
        </ResponsiveContainer>
        {dom && (
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
            <div style={{ fontFamily:'DM Mono', fontSize:12, fontWeight:600, color:dom.color }}>{dom.name}</div>
            <div style={{ fontFamily:'DM Mono', fontSize:11, color:dom.color }}>{dom.value}%</div>
          </div>
        )}
      </div>
      {[{l:'BUY',v:buy_pct,c:'#059669'},{l:'HOLD',v:hold_pct,c:'#d97706'},{l:'SELL',v:sell_pct,c:'#dc2626'}].map(({l,v,c}) => (
        <div key={l} style={{ marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontFamily:'DM Mono', fontSize:10, color:'#a1a1aa' }}>{l}</span>
            <span style={{ fontFamily:'DM Mono', fontSize:10, color:c, fontWeight:600 }}>{v}%</span>
          </div>
          <div className="score-track"><div className="score-fill" style={{ width:`${v}%`, background:c }}/></div>
        </div>
      ))}
    </div>
  )
}
