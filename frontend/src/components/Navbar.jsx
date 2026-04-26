import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useStockStore } from '../store/useStockStore.js'
import { fmt } from '../utils/format.js'

export default function Navbar() {
  const { wsConnected, lastUpdate } = useStockStore()
  const location = useLocation()

  return (
    <header style={{
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid #e8e8ec',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', gap: 0 }}>

        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginRight: 32 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #e91e8c, #c2185b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(233,30,140,0.3)',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polyline points="1,11 4,6 7,9 10,4 13,6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'Figtree', fontWeight: 700, fontSize: 16, color: '#111118', letterSpacing: '-0.02em' }}>
            StockPulse
          </span>
        </Link>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
          {[
            { to: '/', label: 'Markets' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} style={{
              textDecoration: 'none',
              padding: '5px 11px',
              borderRadius: 7,
              fontFamily: 'Figtree', fontSize: 13.5, fontWeight: 500,
              color: location.pathname === to ? '#e91e8c' : '#71717a',
              background: location.pathname === to ? '#fdf2f8' : 'transparent',
              transition: 'all 0.14s',
            }}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {lastUpdate && (
            <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#3f3f46', fontWeight: 500 }}>
              {fmt.time(lastUpdate)}
            </span>
          )}

          {/* Live indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 99,
            background: wsConnected ? '#fdf2f8' : '#fef2f2',
            border: `1px solid ${wsConnected ? 'rgba(233,30,140,0.2)' : 'rgba(220,38,38,0.2)'}`,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: wsConnected ? '#e91e8c' : '#dc2626',
              animation: wsConnected ? 'livePulse 2s ease infinite' : 'none',
            }}/>
            <span style={{ fontFamily: 'DM Mono', fontSize: 10, fontWeight: 500, color: wsConnected ? '#e91e8c' : '#dc2626', letterSpacing: '0.04em' }}>
              {wsConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
