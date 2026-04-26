export const fmt = {
  price: (v, d = 2) => {
    if (v == null || isNaN(v)) return '—'
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)
  },
  pct: (v) => {
    if (v == null || isNaN(v)) return '—'
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
  },
  volume: (v) => {
    if (v == null) return '—'
    if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`
    if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
    return String(v)
  },
  marketCap: (v) => {
    if (v == null) return '—'
    if (v >= 1e13) return `₹${(v / 1e13).toFixed(2)}L Cr`
    if (v >= 1e7)  return `₹${(v / 1e7).toFixed(2)}Cr`
    if (v >= 1e5)  return `₹${(v / 1e5).toFixed(2)}L`
    return `₹${v}`
  },
  shortDate: (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  },
  shortDateTime: (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  },
  time: (date) => {
    if (!date) return ''
    return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  },
  signalColor: (s) => {
    if (!s) return '#a1a1aa'
    const u = s.toUpperCase()
    if (u.includes('BUY'))  return '#059669'
    if (u.includes('SELL')) return '#dc2626'
    return '#d97706'
  },
  signalBadgeClass: (s) => {
    if (!s) return 'badge-neutral'
    const u = s.toUpperCase()
    if (u.includes('BUY'))  return 'badge-buy'
    if (u.includes('SELL')) return 'badge-sell'
    return 'badge-hold'
  },
  changeColor: (v) => v == null ? '#a1a1aa' : v >= 0 ? '#059669' : '#dc2626',
  changeBg: (v) => v == null ? '' : v >= 0 ? '#ecfdf5' : '#fef2f2',
}
