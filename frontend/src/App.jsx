import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import StockDashboard from './pages/StockDashboard.jsx'
import { useStockStore } from './store/useStockStore.js'

export default function App() {
  const { connectWebSocket, disconnectWebSocket } = useStockStore()
  useEffect(() => { connectWebSocket(); return disconnectWebSocket }, [])
  return (
    <div style={{ minHeight: '100vh', background: '#FFC6FF' }}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/stock/:symbol" element={<StockDashboard />} />
      </Routes>
    </div>
  )
}
