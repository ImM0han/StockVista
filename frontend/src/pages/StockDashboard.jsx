import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStockStore } from '../store/useStockStore.js'
import { fmt } from '../utils/format.js'
import PriceChart    from '../components/Charts/PriceChart.jsx'
import VolumeChart   from '../components/Charts/VolumeChart.jsx'
import RSIChart      from '../components/Charts/RSIChart.jsx'
import MACDChart     from '../components/Charts/MACDChart.jsx'
import SignalPieChart from '../components/Charts/SignalPieChart.jsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const A = '#e91e8c', G = '#059669', R = '#dc2626'
const BORDER = '#e8e8ec', SURFACE = '#f9f9fb'

const DURATIONS = [
  { key:'1W', label:'1W', desc:'This Week' },
  { key:'1M', label:'1M', desc:'1 Month' },
  { key:'6M', label:'6M', desc:'6 Months' },
  { key:'1Y', label:'1Y', desc:'1 Year' },
]

/* ── Helpers ─────────────────────────────────────────────── */
const money = (v) => {
  if (v == null || isNaN(v)) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e7) return sign + '₹' + (abs / 1e7).toFixed(2) + ' Cr'
  if (abs >= 1e5) return sign + '₹' + (abs / 1e5).toFixed(2) + ' L'
  return sign + '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(abs)
}

/* ── Score Row ───────────────────────────────────────────── */
function ScoreRow({ label, score, reason }) {
  const pct = Math.min(100, (Math.abs(score) / 2) * 100)
  const c   = score > 0.1 ? G : score < -0.1 ? R : '#a1a1aa'
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
        <span style={{ fontFamily:'DM Mono', fontSize:10, color:'#a1a1aa', width:72, flexShrink:0 }}>{label}</span>
        <div className="score-track" style={{ flex:1 }}>
          <div className="score-fill" style={{ width:`${pct}%`, background:c }}/>
        </div>
        <span style={{ fontFamily:'DM Mono', fontSize:11, fontWeight:600, width:34, textAlign:'right', color:c, flexShrink:0 }}>
          {score >= 0 ? '+' : ''}{score.toFixed(1)}
        </span>
      </div>
      {reason && <div style={{ fontSize:10.5, color:'#a1a1aa', paddingLeft:80, fontStyle:'italic', lineHeight:1.4 }}>{reason}</div>}
    </div>
  )
}

/* ── Chart Section ───────────────────────────────────────── */
function ChartSection({ title, badge, children }) {
  return (
    <div className="card" style={{ overflow:'hidden', marginBottom:10, width:'100%', boxSizing:'border-box' }}>
      <div style={{ padding:'10px 16px', borderBottom:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fafafa' }}>
        <span className="label">{title}</span>
        {badge && <span style={{ fontFamily:'DM Mono', fontSize:9, color:A, background:'#fdf2f8', border:'1px solid rgba(233,30,140,0.2)', padding:'2px 8px', borderRadius:20 }}>{badge}</span>}
      </div>
      <div style={{ padding:'12px 8px 8px' }}>{children}</div>
    </div>
  )
}

/* ── Yearly Returns Bar Chart ────────────────────────────── */
function YearlyReturnsChart({ yearly }) {
  if (!yearly || Object.keys(yearly).length < 2) return null
  const data = Object.entries(yearly).sort(([a],[b]) => Number(a)-Number(b))
    .map(([yr, ret]) => ({ year: String(yr), ret }))
  const tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const v = payload[0].value
    return (
      <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:8, padding:'8px 12px', fontFamily:'DM Mono', fontSize:11, boxShadow:'0 4px 16px rgba(0,0,0,0.08)' }}>
        <div style={{ color:'#a1a1aa', marginBottom:3 }}>{label}</div>
        <div style={{ color:v>=0?G:R, fontWeight:700 }}>{v>=0?'+':''}{v}%</div>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top:4, right:8, left:4, bottom:4 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#f0f0f0" vertical={false}/>
        <XAxis dataKey="year" tick={{ fill:'#a1a1aa', fontSize:9, fontFamily:'DM Mono' }} tickLine={false} axisLine={false}
          interval={data.length > 20 ? 4 : data.length > 10 ? 2 : 0}/>
        <YAxis tick={{ fill:'#a1a1aa', fontSize:9, fontFamily:'DM Mono' }} tickLine={false} axisLine={false} width={40} tickFormatter={v=>`${v}%`}/>
        <Tooltip content={tip}/>
        <ReferenceLine y={0} stroke="#e8e8ec" strokeWidth={1.5}/>
        <Bar dataKey="ret" radius={[3,3,0,0]}>
          {data.map((d,i) => <Cell key={i} fill={d.ret>=0?'rgba(5,150,105,0.75)':'rgba(220,38,38,0.75)'}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ══════════════════════════════════════════════════════════
   INVESTMENT CALCULATOR — Beginner Friendly
   ══════════════════════════════════════════════════════════ */
function InvestmentCalculator({ sym, currentPrice }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [fetchErr, setFetchErr] = useState('')
  const [mode,     setMode]     = useState('return') // 'return' | 'time'
  const [capital,  setCapital]  = useState('')
  const [days,     setDays]     = useState('')
  const [target,   setTarget]   = useState('')
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!sym) return
    setLoading(true); setFetchErr('')
    fetch(`${API}/stock/${sym}/analysis`)
      .then(r => { if (!r.ok) throw new Error('HTTP '+r.status); return r.json() })
      .then(d => { setAnalysis(d); setLoading(false) })
      .catch(e => { setFetchErr(e.message); setLoading(false) })
  }, [sym])

  const stats = analysis?.stats

  const calcResult = useCallback(() => {
    setError(''); setResult(null)
    const cap = parseFloat(String(capital).replace(/,/g,''))
    if (!cap || cap <= 0) { setError('Please enter how much money you want to invest.'); return }
    if (!stats?.cagr)     { setError('Historical data still loading, try again in a moment.'); return }
    const { cagr, annual_vol } = stats
    const price = currentPrice || stats.last_price || 1

    if (mode === 'return') {
      const d = parseInt(days)
      if (!d || d <= 0) { setError('Please enter how many days you plan to hold the stock.'); return }
      const yrs  = d / 365
      const ret  = Math.pow(1 + cagr, yrs) - 1
      const val  = cap * (1 + ret)
      const prof = val - cap
      const vvol = annual_vol * Math.sqrt(yrs)
      const drift = (Math.log(1 + cagr) - 0.5 * annual_vol**2) * yrs
      setResult({
        type:'return', inputDays:d, capital:cap,
        ret:ret*100, val, prof,
        best:  cap * Math.exp(drift + vvol),
        worst: cap * Math.exp(drift - vvol),
        shares: Math.floor(cap / price),
        months: (d/30).toFixed(0),
        yrs: yrs.toFixed(1),
      })
    } else {
      const tgt = parseFloat(target)
      if (!tgt || tgt <= -100) { setError('Please enter the profit % you want to make (e.g. 50 for 50%).'); return }
      if (cagr <= 0 && tgt > 0) { setError(`This stock's historical trend is negative (${(cagr*100).toFixed(1)}%/yr). Reaching a positive target may take very long.`); return }
      if (cagr === 0) { setError('Not enough data to project.'); return }
      const yrsNeeded = Math.log(1 + tgt/100) / Math.log(1 + cagr)
      if (!isFinite(yrsNeeded) || yrsNeeded < 0) { setError('This target cannot be reached with the current trend.'); return }
      const dNeeded = Math.round(yrsNeeded * 365)
      setResult({
        type:'time', capital:cap, tgt,
        daysNeeded:dNeeded, months:(dNeeded/30).toFixed(0),
        years: yrsNeeded.toFixed(1),
        finalVal: cap*(1+tgt/100), profit: cap*(tgt/100),
        shares: Math.floor(cap / price),
      })
    }
  }, [capital, target, days, mode, stats, currentPrice, sym])

  if (loading) return (
    <div style={{ textAlign:'center', padding:'28px 0', color:'#a1a1aa', fontFamily:'Figtree', fontSize:13 }}>
      <div style={{ display:'inline-flex', alignItems:'center', gap:10 }}>
        <div style={{ width:14, height:14, border:`2px solid ${A}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        Loading full price history since IPO…
      </div>
    </div>
  )
  if (fetchErr) return (
    <div style={{ padding:14, background:'#fef2f2', border:'1px solid rgba(220,38,38,0.2)', borderRadius:8, fontSize:12, color:R }}>
      Could not load historical data: {fetchErr}
    </div>
  )
  if (!stats) return null

  const cagrColor = stats.cagr >= 0 ? G : R
  const yearsLabel = `${stats.total_years} years (${stats.listing_year}–${new Date().getFullYear()})`

  return (
    <div>
      {/* ── What is this? ─────────────────────────────────── */}
      <div style={{ background:'#f0fdf4', border:'1px solid rgba(5,150,105,0.2)', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
        <div style={{ fontFamily:'Figtree', fontSize:12, fontWeight:700, color:G, marginBottom:4 }}>📚 How this works</div>
        <div style={{ fontSize:12, color:'#3f3f46', lineHeight:1.6 }}>
          This calculator uses <strong>{sym?.replace('.NS','')}'s real {stats.total_years}-year price history</strong> to estimate what your investment might grow to.
          It is based on past performance — not a guarantee of future results.
        </div>
      </div>

      {/* ── Historical snapshot (simple) ─────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
        <div style={{ padding:'12px 14px', background:stats.cagr>=0?'#f0fdf4':'#fef2f2', border:`1px solid ${cagrColor}22`, borderRadius:10 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#a1a1aa', marginBottom:4 }}>
            Average Yearly Growth ({yearsLabel})
          </div>
          <div style={{ fontFamily:'DM Mono', fontSize:24, fontWeight:700, color:cagrColor }}>
            {stats.cagr_pct >= 0 ? '+' : ''}{stats.cagr_pct}%
          </div>
          <div style={{ fontSize:11, color:'#71717a', marginTop:3 }}>per year on average</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          {[
            { l:'Good Years',  v:`${stats.pos_years} / ${stats.pos_years+stats.neg_years}`, c:G },
            { l:'Bad Years',   v:`${stats.neg_years} / ${stats.pos_years+stats.neg_years}`, c:R },
            { l:'Best Year',   v:`${stats.best_year?.year}: +${stats.best_year?.return_pct}%`,  c:G },
            { l:'Worst Year',  v:`${stats.worst_year?.year}: ${stats.worst_year?.return_pct}%`, c:R },
          ].map(({l,v,c}) => (
            <div key={l} style={{ background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:8, padding:'8px 10px' }}>
              <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', color:'#a1a1aa', marginBottom:3 }}>{l}</div>
              <div style={{ fontFamily:'DM Mono', fontSize:11, fontWeight:700, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Yearly chart ─────────────────────────────────── */}
      {stats.yearly_returns && Object.keys(stats.yearly_returns).length > 2 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:'Figtree', fontSize:11, fontWeight:600, color:'#3f3f46', marginBottom:6 }}>
            📊 Returns each year — green = profit, red = loss
          </div>
          <YearlyReturnsChart yearly={stats.yearly_returns}/>
        </div>
      )}

      <div style={{ height:1, background:`linear-gradient(90deg,transparent,${BORDER},transparent)`, margin:'16px 0' }}/>

      {/* ── Mode toggle ──────────────────────────────────── */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontFamily:'Figtree', fontSize:13, fontWeight:700, color:'#111118', marginBottom:8 }}>
          What do you want to calculate?
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[
            { k:'return', icon:'💰', title:'My return', desc:'I know how long I will invest — show me the profit' },
            { k:'time',   icon:'⏱',  title:'Time needed', desc:'I know my profit target — show me how long it takes' },
          ].map(({ k, icon, title, desc }) => (
            <button key={k} onClick={() => { setMode(k); setResult(null); setError('') }} style={{
              padding:'12px 14px', borderRadius:10, cursor:'pointer', textAlign:'left', transition:'all 0.14s',
              border:`2px solid ${mode===k ? A : BORDER}`,
              background: mode===k ? '#fdf2f8' : '#fff',
              outline:'none',
            }}>
              <div style={{ fontSize:18, marginBottom:5 }}>{icon}</div>
              <div style={{ fontFamily:'Figtree', fontSize:12, fontWeight:700, color: mode===k?A:'#111118' }}>{title}</div>
              <div style={{ fontSize:11, color:'#a1a1aa', marginTop:2, lineHeight:1.4 }}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Inputs ─────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
        {/* Investment */}
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#3f3f46', display:'block', marginBottom:6 }}>
            💵 How much to invest?
          </label>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', fontFamily:'DM Mono', fontSize:13, color:'#a1a1aa' }}>₹</span>
            <input type="number" min="1" placeholder="50000" value={capital}
              onChange={e => { setCapital(e.target.value); setResult(null) }}
              onKeyDown={e => e.key==='Enter' && calcResult()}
              style={{ width:'100%', padding:'9px 10px 9px 26px', fontFamily:'DM Mono', fontSize:14, color:'#111118', border:`2px solid ${BORDER}`, borderRadius:9, background:'#fff', outline:'none' }}
              onFocus={e => { e.target.style.borderColor=A; e.target.style.boxShadow=`0 0 0 3px rgba(233,30,140,0.1)` }}
              onBlur={e  => { e.target.style.borderColor=BORDER; e.target.style.boxShadow='none' }}/>
          </div>
        </div>

        {/* Days or Target */}
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#3f3f46', display:'block', marginBottom:6 }}>
            {mode==='return' ? '📅 For how many days?' : '🎯 What profit % do you want?'}
          </label>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', fontFamily:'DM Mono', fontSize:13, color:'#a1a1aa' }}>
              {mode==='return' ? 'days' : '%'}
            </span>
            <input type="number" min={mode==='return'?'1':'-99'}
              placeholder={mode==='return'?'365':'50'}
              value={mode==='return' ? days : target}
              onChange={e => { mode==='return'?setDays(e.target.value):setTarget(e.target.value); setResult(null) }}
              onKeyDown={e => e.key==='Enter' && calcResult()}
              style={{ width:'100%', padding:'9px 40px 9px 12px', fontFamily:'DM Mono', fontSize:14, color:'#111118', border:`2px solid ${BORDER}`, borderRadius:9, background:'#fff', outline:'none' }}
              onFocus={e => { e.target.style.borderColor=A; e.target.style.boxShadow=`0 0 0 3px rgba(233,30,140,0.1)` }}
              onBlur={e  => { e.target.style.borderColor=BORDER; e.target.style.boxShadow='none' }}/>
          </div>
        </div>
      </div>

      {/* Quick presets */}
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'#a1a1aa' }}>Quick select:</span>
        {mode==='return'
          ? [['1 Year',365],['2 Years',730],['3 Years',1095],['5 Years',1825],['10 Years',3650]].map(([l,d]) => (
            <button key={l} onClick={() => { setDays(String(d)); setResult(null) }} style={{
              fontFamily:'Figtree', fontSize:11, fontWeight:500, padding:'4px 10px', borderRadius:7, cursor:'pointer', transition:'all 0.12s',
              border:`1px solid ${String(days)===String(d)?A:BORDER}`,
              background: String(days)===String(d)?'#fdf2f8':'#fff',
              color: String(days)===String(d)?A:'#71717a',
            }}>{l}</button>
          ))
          : [['25%',25],['50%',50],['100% (Double)',100],['200%',200],['500%',500]].map(([l,t]) => (
            <button key={l} onClick={() => { setTarget(String(t)); setResult(null) }} style={{
              fontFamily:'Figtree', fontSize:11, fontWeight:500, padding:'4px 10px', borderRadius:7, cursor:'pointer', transition:'all 0.12s',
              border:`1px solid ${target===String(t)?A:BORDER}`,
              background: target===String(t)?'#fdf2f8':'#fff',
              color: target===String(t)?A:'#71717a',
            }}>{l}</button>
          ))
        }
      </div>

      {/* Calculate button */}
      <button onClick={calcResult} style={{
        width:'100%', padding:'12px', borderRadius:10, border:'none', cursor:'pointer',
        fontFamily:'Figtree', fontSize:14, fontWeight:700, color:'#fff',
        background:`linear-gradient(135deg,${A},#c2185b)`,
        boxShadow:`0 4px 14px rgba(233,30,140,0.3)`, transition:'all 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.boxShadow='0 6px 22px rgba(233,30,140,0.4)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow='0 4px 14px rgba(233,30,140,0.3)'}>
        {mode==='return' ? '🔮 Show me my estimated return' : '⏳ Show me how long it takes'}
      </button>

      {/* Error */}
      {error && (
        <div style={{ marginTop:12, padding:'12px 14px', background:'#fef2f2', border:'1px solid rgba(220,38,38,0.2)', borderRadius:9, fontSize:12, color:R, lineHeight:1.5 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Result ─────────────────────────────────────────── */}
      {result && (
        <div className="slide-up" style={{ marginTop:18 }}>
          <div style={{ height:1, background:`linear-gradient(90deg,transparent,${BORDER},transparent)`, marginBottom:18 }}/>

          {result.type === 'return' && (
            <>
              {/* Main result card */}
              <div style={{ padding:'20px', borderRadius:12, marginBottom:12,
                background: result.ret>=0 ? '#f0fdf4' : '#fef2f2',
                border:`2px solid ${result.ret>=0 ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.25)'}` }}>
                <div style={{ fontFamily:'Figtree', fontSize:12, color:result.ret>=0?G:R, fontWeight:700, marginBottom:6 }}>
                  {result.ret>=0 ? '📈' : '📉'} If you invest {money(result.capital)} for {result.inputDays} days ({result.months} months):
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:14, flexWrap:'wrap', marginBottom:10 }}>
                  <div>
                    <div style={{ fontFamily:'DM Mono', fontSize:32, fontWeight:700, letterSpacing:'-0.04em', color:result.ret>=0?G:R }}>
                      {result.ret>=0?'+':''}{result.ret.toFixed(1)}%
                    </div>
                    <div style={{ fontSize:12, color:result.ret>=0?G:R, fontWeight:600, marginTop:2 }}>
                      expected return
                    </div>
                  </div>
                  <div style={{ width:1, height:44, background: result.ret>=0?'rgba(5,150,105,0.2)':'rgba(220,38,38,0.2)' }}/>
                  <div>
                    <div style={{ fontFamily:'DM Mono', fontSize:24, fontWeight:700, color:result.ret>=0?G:R }}>
                      {result.prof>=0?'+':''}{money(result.prof)}
                    </div>
                    <div style={{ fontSize:12, color:'#71717a', marginTop:2 }}>estimated profit/loss</div>
                  </div>
                </div>
                <div style={{ padding:'10px 14px', background:'rgba(255,255,255,0.7)', borderRadius:8, fontFamily:'Figtree', fontSize:12, color:'#3f3f46', lineHeight:1.5 }}>
                  Your {money(result.capital)} could grow to <strong style={{ fontFamily:'DM Mono', color:result.ret>=0?G:R }}>{money(result.val)}</strong>.
                  You could buy about <strong style={{ fontFamily:'DM Mono' }}>{result.shares} shares</strong> at today's price of ₹{fmt.price(currentPrice)}.
                </div>
              </div>

              {/* Risk range */}
              <div style={{ padding:'16px', background:'#fdf2f8', border:'1px solid rgba(233,30,140,0.15)', borderRadius:11 }}>
                <div style={{ fontFamily:'Figtree', fontSize:12, fontWeight:700, color:A, marginBottom:10 }}>
                  🎲 Possible range — based on {stats.annual_vol_pct}% historical volatility
                </div>
                <div style={{ fontFamily:'Figtree', fontSize:11, color:'#71717a', marginBottom:12, lineHeight:1.5 }}>
                  Stock prices don't move in straight lines. Based on how much {sym?.replace('.NS','')} has moved in the past, here's the realistic range:
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div style={{ padding:'12px', background:'#fef2f2', border:'1px solid rgba(220,38,38,0.2)', borderRadius:9, textAlign:'center' }}>
                    <div style={{ fontSize:11, color:R, fontWeight:700, marginBottom:4 }}>😟 Worst case (−1σ)</div>
                    <div style={{ fontFamily:'DM Mono', fontSize:18, fontWeight:700, color:R }}>{money(result.worst)}</div>
                    <div style={{ fontSize:10, color:'#a1a1aa', marginTop:3 }}>
                      {result.worst < result.capital ? `Loss of ${money(result.capital-result.worst)}` : `Gain of +${money(result.worst-result.capital)}`}
                    </div>
                  </div>
                  <div style={{ padding:'12px', background:'#f0fdf4', border:'1px solid rgba(5,150,105,0.2)', borderRadius:9, textAlign:'center' }}>
                    <div style={{ fontSize:11, color:G, fontWeight:700, marginBottom:4 }}>😊 Best case (+1σ)</div>
                    <div style={{ fontFamily:'DM Mono', fontSize:18, fontWeight:700, color:G }}>{money(result.best)}</div>
                    <div style={{ fontSize:10, color:'#a1a1aa', marginTop:3 }}>Gain of +{money(result.best-result.capital)}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {result.type === 'time' && (
            <>
              <div style={{ padding:'20px', borderRadius:12, marginBottom:12, background:'#fdf2f8', border:`2px solid rgba(233,30,140,0.25)` }}>
                <div style={{ fontFamily:'Figtree', fontSize:12, fontWeight:700, color:A, marginBottom:6 }}>
                  ⏱ Time to make {result.tgt >= 0 ? '+' : ''}{result.tgt}% profit on {money(result.capital)}:
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:10, flexWrap:'wrap' }}>
                  <div style={{ fontFamily:'DM Mono', fontSize:32, fontWeight:700, color:A, letterSpacing:'-0.04em' }}>
                    {result.years} years
                  </div>
                  <div style={{ fontFamily:'DM Mono', fontSize:16, color:'#71717a' }}>
                    ≈ {result.months} months · {result.daysNeeded} days
                  </div>
                </div>
                <div style={{ padding:'10px 14px', background:'rgba(255,255,255,0.7)', borderRadius:8, fontFamily:'Figtree', fontSize:12, color:'#3f3f46', lineHeight:1.5 }}>
                  Based on {sym?.replace('.NS','')}'s average growth of <strong>{stats.cagr_pct}% per year</strong>,
                  your {money(result.capital)} could become <strong style={{ fontFamily:'DM Mono', color:G }}>{money(result.finalVal)}</strong> — a profit of <strong style={{ color:G }}>{money(result.profit)}</strong>.
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { l:'Final Amount', v:money(result.finalVal), c:G },
                  { l:'Your Profit',  v:money(result.profit),   c:G },
                  { l:'Shares Bought', v:`${result.shares} shares`, c:'#111118', sub:`@ ₹${fmt.price(currentPrice)}` },
                ].map(({l,v,c,sub}) => (
                  <div key={l} style={{ padding:'12px', background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:9, textAlign:'center' }}>
                    <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#a1a1aa', marginBottom:5 }}>{l}</div>
                    <div style={{ fontFamily:'DM Mono', fontSize:14, fontWeight:700, color:c }}>{v}</div>
                    {sub && <div style={{ fontFamily:'DM Mono', fontSize:9, color:'#a1a1aa', marginTop:3 }}>{sub}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Disclaimer */}
          <div style={{ marginTop:14, padding:'10px 14px', background:'#f9f9fb', border:`1px solid ${BORDER}`, borderRadius:8 }}>
            <div style={{ fontSize:10, color:'#a1a1aa', lineHeight:1.6 }}>
              ⚠️ <strong>Important:</strong> These are estimates based on {sym?.replace('.NS','')}'s past {stats.total_years} years of data ({analysis.count} weekly data points).
              Stock markets are unpredictable. You could make more, less, or even lose money.
              <strong> This is not financial advice.</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Skeleton ────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div style={{ maxWidth:1440, margin:'0 auto', padding:'28px 24px' }}>
      <div className="skel" style={{ height:100, borderRadius:12, marginBottom:12 }}/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:12 }}>
        <div>{[300,150,160,160,500].map((h,i) => <div key={i} className="skel" style={{ height:h, borderRadius:12, marginBottom:10 }}/>)}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[360,210,180,120].map((h,i) => <div key={i} className="skel" style={{ height:h, borderRadius:12 }}/>)}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function StockDashboard() {
  const { symbol } = useParams()
  const { stockDetail, detailLoading, detailError, fetchStockDetail, quotes, activeDuration } = useStockStore()
  const [duration, setDuration] = useState(activeDuration || '6M')
  const sym = symbol?.toUpperCase()

  useEffect(() => { if (sym) fetchStockDetail(sym, duration) }, [sym, duration])

  const q = quotes[sym] || stockDetail?.quote
  if (detailLoading) return <Skeleton />
  if (detailError) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
      <div style={{ fontSize:13, color:R, fontFamily:'DM Mono' }}>{detailError}</div>
      <Link to="/" style={{ color:A, fontFamily:'Figtree', fontSize:13 }}>← Back to Markets</Link>
    </div>
  )
  if (!stockDetail) return null

  const { indicators, signal, meta, history } = stockDetail
  const sigColor = fmt.signalColor(signal?.signal)
  const sigBadge = fmt.signalBadgeClass(signal?.signal)

  return (
    <div className="fade-in" style={{ maxWidth:1440, margin:'0 auto', padding:'28px 24px' }}>

      {/* Breadcrumb */}
      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:18, fontFamily:'DM Mono', fontSize:11, color:'#a1a1aa' }}>
        <Link to="/" style={{ color:'#a1a1aa', textDecoration:'none' }}
          onMouseEnter={e=>e.target.style.color=A} onMouseLeave={e=>e.target.style.color='#a1a1aa'}>Markets</Link>
        <span>/</span>
        <span style={{ color:'#71717a' }}>{meta?.index||'NSE'}</span>
        <span>/</span>
        <span style={{ color:A, fontWeight:500 }}>{sym}</span>
      </div>

      {/* Header */}
      <div className="card" style={{ padding:'20px 24px', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'stretch', flexWrap:'wrap', gap:0 }}>
          <div style={{ paddingRight:28, borderRight:`1px solid #f0f0f0`, marginRight:24 }}>
            <div className="label" style={{ marginBottom:4 }}>{meta?.index||'NSE'} · {meta?.sector||''}</div>
            <div style={{ fontFamily:'DM Mono', fontSize:24, fontWeight:600, color:'#111118', letterSpacing:'-0.03em', lineHeight:1 }}>{sym?.replace('.NS','')}</div>
            <div style={{ fontSize:12, color:'#a1a1aa', marginTop:4 }}>{q?.name}</div>
          </div>
          <div style={{ paddingRight:28, borderRight:'1px solid #f0f0f0', marginRight:24 }}>
            <div className="label" style={{ marginBottom:4 }}>Last Traded Price</div>
            <div style={{ fontFamily:'DM Mono', fontSize:30, fontWeight:600, color:'#111118', letterSpacing:'-0.04em', lineHeight:1 }}>
              <span style={{ fontSize:14, color:'#a1a1aa', marginRight:2 }}>₹</span>{fmt.price(q?.price)}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:5, alignItems:'center' }}>
              <span style={{ fontFamily:'DM Mono', fontSize:13, fontWeight:600, color:fmt.changeColor(q?.change_pct) }}>{fmt.pct(q?.change_pct)}</span>
              {q?.change!=null && <span style={{ fontFamily:'DM Mono', fontSize:12, color:'#a1a1aa' }}>{q.change>=0?'+':''}₹{fmt.price(Math.abs(q.change))}</span>}
            </div>
          </div>
          <div style={{ display:'flex', flex:1, flexWrap:'wrap' }}>
            {[
              { l:'Open',    v:q?.open    ?`₹${fmt.price(q.open)}`   :null, c:'#111118' },
              { l:'High',    v:q?.day_high?`₹${fmt.price(q.day_high)}`:null, c:G },
              { l:'Low',     v:q?.day_low ?`₹${fmt.price(q.day_low)}` :null, c:R },
              { l:'Volume',  v:fmt.volume(q?.volume), c:'#111118' },
              { l:'Mkt Cap', v:fmt.marketCap(q?.market_cap), c:'#111118' },
            ].map(({l,v,c}) => (
              <div key={l} style={{ padding:'0 18px', borderRight:'1px solid #f4f4f5' }}>
                <div className="label" style={{ marginBottom:4 }}>{l}</div>
                <div style={{ fontFamily:'DM Mono', fontSize:13, fontWeight:500, color:c }}>{v??'—'}</div>
              </div>
            ))}
          </div>
          {signal?.signal && (
            <div style={{ paddingLeft:24, display:'flex', flexDirection:'column', alignItems:'flex-end', justifyContent:'center', borderLeft:'1px solid #f0f0f0', minWidth:130 }}>
              <div className="label" style={{ marginBottom:6 }}>{signal.duration_label} Signal</div>
              <span className={`badge ${sigBadge}`} style={{ fontSize:14, padding:'5px 14px', borderRadius:8 }}>{signal.signal}</span>
              <div style={{ fontFamily:'DM Mono', fontSize:10, color:'#a1a1aa', marginTop:6 }}>{signal.confidence}% confidence</div>
            </div>
          )}
        </div>
      </div>

      {/* Duration */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <span className="label">Timeframe:</span>
        <div style={{ display:'flex', gap:3, background:'#f4f4f5', borderRadius:10, padding:3 }}>
          {DURATIONS.map(d => (
            <button key={d.key} onClick={() => setDuration(d.key)} className={`seg-btn ${duration===d.key?'active':''}`}>{d.label}</button>
          ))}
        </div>
        <span style={{ fontFamily:'DM Mono', fontSize:10, color:'#a1a1aa', fontStyle:'italic' }}>
          — {DURATIONS.find(d=>d.key===duration)?.desc}
        </span>
      </div>

      {/* ── Main 2-column layout ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:12, alignItems:'start', minWidth:0 }}>

        {/* LEFT — minWidth:0 prevents grid blowout */}
        <div style={{ display:'flex', flexDirection:'column', minWidth:0, width:'100%' }}>
          <ChartSection title="Price & Moving Averages"
            badge={duration==='1W'?'EMA 9/21':duration==='1M'?'EMA 10/30':duration==='6M'?'EMA 50/100':'EMA 13w/26w'}>
            <PriceChart indicators={indicators} quote={q} duration={duration} historyData={history}/>
          </ChartSection>

          <ChartSection title="Volume" badge="Green = up day · Red = down day">
            <VolumeChart indicators={indicators} duration={duration}/>
          </ChartSection>

          <ChartSection title="RSI — Relative Strength Index"
            badge={duration==='1W'?'RSI(7)':duration==='1Y'?'RSI(21)':'RSI(14)'}>
            <RSIChart indicators={indicators} duration={duration}/>
          </ChartSection>

          <ChartSection title="MACD — Momentum Indicator"
            badge={duration==='1W'?'5/13/4':duration==='1M'?'8/21/5':duration==='6M'?'12/26/9':'26/52/9'}>
            <MACDChart indicators={indicators} duration={duration}/>
          </ChartSection>

          {/* Investment Calculator */}
          <div className="card" style={{ overflow:'hidden', flex:1, borderTop:`3px solid ${A}`, width:'100%', boxSizing:'border-box' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid #f0f0f0`, display:'flex', alignItems:'center', gap:10, background:'#fdf2f8' }}>
              <div style={{ width:30, height:30, borderRadius:8, background:`linear-gradient(135deg,${A},#c2185b)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily:'Figtree', fontSize:13, fontWeight:700, color:'#111118' }}>Investment Calculator</div>
                <div style={{ fontFamily:'DM Mono', fontSize:9, color:A, letterSpacing:'0.06em' }}>USES FULL HISTORY FROM IPO DATE · {sym?.replace('.NS','')}</div>
              </div>
            </div>
            <div style={{ padding:'18px 16px' }}>
              <InvestmentCalculator sym={sym} currentPrice={q?.price}/>
            </div>
          </div>
        </div>

        {/* RIGHT sidebar — each card flush, last one flex-grows to match left */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

          {/* Signal card */}
          {signal && (
            <div className="card slide-up" style={{ overflow:'hidden', borderTop:`3px solid ${sigColor}` }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f4f4f5', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span className="label">AI Signal · {signal.duration_label}</span>
                <span style={{ fontFamily:'DM Mono', fontSize:10, color:'#a1a1aa' }}>{signal.confidence}% conf</span>
              </div>
              <div style={{ padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ fontFamily:'DM Mono', fontSize:26, fontWeight:600, color:sigColor, letterSpacing:'-0.02em' }}>{signal.signal}</div>
                  <div style={{ fontFamily:'DM Mono', fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:7,
                    background:sigColor===G?'#ecfdf5':sigColor===R?'#fef2f2':'#fffbeb',
                    color:sigColor, border:`1px solid ${sigColor}25` }}>
                    {signal.total_score>=0?'+':''}{signal.total_score}
                  </div>
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span className="label">Signal Strength</span>
                    <span style={{ fontFamily:'DM Mono', fontSize:10, color:sigColor }}>{signal.confidence}%</span>
                  </div>
                  <div className="score-track" style={{ height:5 }}>
                    <div className="score-fill" style={{ width:`${signal.confidence}%`, background:`linear-gradient(90deg,${sigColor}66,${sigColor})` }}/>
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div className="label" style={{ marginBottom:10 }}>Indicator Scores</div>
                  {signal.scores && Object.entries(signal.scores).map(([k,v]) => (
                    <ScoreRow key={k} label={k} score={v} reason={signal.reasons?.[k]}/>
                  ))}
                </div>
                {signal.signal==='HOLD' && signal.estimated_return_pct!=null && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                    <div style={{ background:'#fafafa', border:'1px solid #f0f0f0', borderRadius:8, padding:'10px 12px' }}>
                      <div className="label" style={{ marginBottom:4 }}>Est. Return</div>
                      <div style={{ fontFamily:'DM Mono', fontSize:16, fontWeight:600, color:signal.estimated_return_pct>=0?G:R }}>
                        {signal.estimated_return_pct>=0?'+':''}{signal.estimated_return_pct}%
                      </div>
                    </div>
                    <div style={{ background:'#fafafa', border:'1px solid #f0f0f0', borderRadius:8, padding:'10px 12px' }}>
                      <div className="label" style={{ marginBottom:4 }}>Hold Period</div>
                      <div style={{ fontFamily:'DM Mono', fontSize:16, fontWeight:600, color:'#d97706' }}>{signal.holding_period_label}</div>
                    </div>
                  </div>
                )}
                <p style={{ fontSize:11, color:'#a1a1aa', fontStyle:'italic', margin:0, paddingTop:10, borderTop:'1px solid #f4f4f5' }}>{signal.description}</p>
              </div>
            </div>
          )}

          {signal?.pie && (
            <div className="card">
              <div style={{ padding:'10px 16px', borderBottom:'1px solid #f4f4f5', background:'#fafafa' }}>
                <span className="label">Signal Distribution</span>
              </div>
              <div style={{ padding:'16px' }}><SignalPieChart pie={signal.pie}/></div>
            </div>
          )}

          {signal?.snapshot && (
            <div className="card">
              <div style={{ padding:'10px 16px', borderBottom:'1px solid #f4f4f5', background:'#fafafa' }}>
                <span className="label">Indicator Snapshot</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                {[
                  { l:'RSI',      v:signal.snapshot.rsi?.toFixed(2), c:signal.snapshot.rsi<30?G:signal.snapshot.rsi>70?R:'#111118' },
                  { l:'MACD',     v:signal.snapshot.macd?.toFixed(4),c:signal.snapshot.macd>=0?G:R },
                  { l:'MA Short', v:signal.snapshot.ma_short?`₹${fmt.price(signal.snapshot.ma_short)}`:null, c:(q?.price>=signal.snapshot.ma_short)?G:R },
                  { l:'MA Long',  v:signal.snapshot.ma_long ?`₹${fmt.price(signal.snapshot.ma_long)}` :null, c:(q?.price>=signal.snapshot.ma_long) ?G:R },
                ].map(({l,v,c}) => (
                  <div key={l} style={{ padding:'10px 14px', borderBottom:'1px solid #f4f4f5', borderRight:'1px solid #f4f4f5' }}>
                    <div className="label" style={{ marginBottom:4 }}>{l}</div>
                    <div style={{ fontFamily:'DM Mono', fontSize:13, fontWeight:500, color:c }}>{v??'—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeframe guide — flex:1 makes it fill remaining height */}
          <div className="card" style={{ flex:1 }}>
            <div style={{ padding:'10px 16px', borderBottom:'1px solid #f4f4f5', background:'#fafafa' }}>
              <span className="label">Timeframe Guide</span>
            </div>
            <div style={{ padding:'8px' }}>
              {DURATIONS.map(d => (
                <button key={d.key} onClick={() => setDuration(d.key)} style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'9px 10px', borderRadius:8, border:'none', textAlign:'left',
                  background:duration===d.key?'#fdf2f8':'transparent',
                  cursor:'pointer', marginBottom:2, transition:'background 0.14s',
                }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <span style={{ fontFamily:'DM Mono', fontSize:12, fontWeight:600, color:duration===d.key?A:'#71717a' }}>{d.key}</span>
                    <span style={{ fontSize:11, color:'#a1a1aa' }}>{d.desc}</span>
                  </div>
                  {duration===d.key && <div style={{ width:6, height:6, borderRadius:'50%', background:A }}/>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <Link to="/" style={{ fontFamily:'DM Mono', fontSize:11, color:'#a1a1aa', textDecoration:'none' }}
          onMouseEnter={e=>e.target.style.color=A} onMouseLeave={e=>e.target.style.color='#a1a1aa'}>
          ← Back to Markets
        </Link>
        <span style={{ fontFamily:'DM Mono', fontSize:9, color:'#d4d4d8' }}>
          Not financial advice · {signal?.duration_label} signal data
        </span>
      </div>
    </div>
  )
}
