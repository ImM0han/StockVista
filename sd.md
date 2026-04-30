# 📈 StockPulse — Real-Time Stock Market Analysis App

A production-grade full-stack stock market dashboard with real-time WebSocket updates, technical indicators, and AI-powered BUY/SELL/HOLD signals.

---

## 🗂 Project Structure

```
stock-app/
├── backend/
│   ├── main.py                    # FastAPI app + WebSocket + REST endpoints
│   ├── requirements.txt
│   ├── models/
│   │   └── __init__.py
│   └── services/
│       ├── stock_service.py       # yfinance data fetching + TTL caching
│       ├── indicator_service.py   # RSI, MACD, MA, Bollinger Bands
│       └── signal_service.py      # AI BUY/SELL/HOLD scoring engine
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── package.json
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── api/
        │   └── stockApi.js        # REST API helpers
        ├── store/
        │   └── useStockStore.js   # Zustand state + WebSocket management
        ├── hooks/
        │   └── useDebounce.js     # Debounce + animated value hooks
        ├── utils/
        │   └── format.js          # Number/date formatters
        ├── components/
        │   ├── Navbar.jsx
        │   ├── SearchBar.jsx      # Live debounced search
        │   ├── StockCard.jsx      # Animated price flash cards
        │   ├── SignalCard.jsx     # BUY/SELL/HOLD decision card
        │   └── Charts/
        │       ├── PriceChart.jsx    # Price + MA + Bollinger Bands
        │       ├── VolumeChart.jsx   # Volume bars + SMA
        │       ├── RSIChart.jsx      # RSI area chart
        │       ├── MACDChart.jsx     # MACD + histogram
        │       └── SignalPieChart.jsx # Buy/Hold/Sell distribution
        └── pages/
            ├── Home.jsx              # Real-time stock grid
            └── StockDashboard.jsx    # Full detail dashboard
```

---

## ⚙️ Setup & Installation

### Backend (Python FastAPI)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate          # macOS/Linux
# OR: venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at: http://localhost:8000  
API docs (Swagger): http://localhost:8000/docs

### Frontend (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at: http://localhost:5173

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health + WS client count |
| GET | `/stocks` | All default stock quotes |
| GET | `/stocks?symbols=AAPL,TSLA` | Filtered stock quotes |
| GET | `/stock/{symbol}` | Full dashboard data (quote + history + indicators + signal) |
| GET | `/stock/{symbol}?period=1y` | With custom period (1mo/3mo/6mo/1y/2y/5y) |
| GET | `/signal/{symbol}` | AI signal only |
| GET | `/search?q=NVDA` | Quick symbol lookup |
| WS | `/ws/stocks` | Real-time quote stream (broadcasts every 3s) |

---

## 🤖 AI Signal Logic

The signal engine scores 4 independent indicators on a scale of **-2 to +2**:

| Indicator | BUY signal | SELL signal |
|-----------|-----------|-------------|
| **RSI** | RSI < 30 (oversold) | RSI > 70 (overbought) |
| **MACD** | Bullish crossover | Bearish crossover |
| **MA Cross** | Price > MA50, golden cross | Price < MA200, death cross |
| **Bollinger** | Price near lower band | Price near upper band |

**Total score → Decision:**
- `>= 3.5` → STRONG BUY
- `>= 1.0` → BUY
- `<= -3.5` → STRONG SELL
- `<= -1.0` → SELL
- else → HOLD (with estimated return % and holding period)

---

## 📡 WebSocket Protocol

**Client → Server:**
```json
{ "type": "ping" }
{ "type": "subscribe", "symbols": ["AAPL", "TSLA"] }
```

**Server → Client:**
```json
{ "type": "pong" }
{ "type": "quotes", "data": [...quotes], "ts": 1720000000.0 }
```

---

## 🎨 Features

- ⚡ Real-time price updates via WebSocket (3-second intervals)
- 🌊 Price flash animation (green ↑ / red ↓) on every tick
- 🔍 Debounced search with live result dropdown
- 📊 Interactive Recharts with custom dark-theme tooltips
- 🧠 Multi-indicator AI signal with confidence scoring
- 🥧 Signal distribution pie chart (Buy/Hold/Sell %)
- 💀 Skeleton loaders for all async states
- 🔄 WebSocket auto-reconnect on disconnect
- 🗂 Collapsible chart sections
- 📱 Fully responsive layout

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI + uvicorn |
| Real-time | WebSockets (native FastAPI) |
| Data | yfinance |
| Indicators | ta (Technical Analysis library) |
| Math | pandas + numpy |
| Frontend | React 18 + Vite |
| State | Zustand |
| Charts | Recharts |
| Styling | TailwindCSS |
| Routing | React Router v6 |

---

## 🔧 Environment Variables (optional)

Create `frontend/.env` to override defaults:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/stocks
```

---

## 📦 Supported Symbols

Works with any valid yfinance symbol:
- US stocks: `AAPL`, `TSLA`, `NVDA`, `MSFT`
- Indian stocks: `RELIANCE.NS`, `TCS.NS`, `INFY.NS`
- ETFs: `SPY`, `QQQ`, `VTI`
- Crypto: `BTC-USD`, `ETH-USD`
- Indices: `^GSPC`, `^NSEI`

---

## ⚠️ Notes

- yfinance data may be delayed 15–20 minutes for some exchanges
- Rate limiting may apply during heavy usage; the TTL cache reduces API calls
- For production: add authentication, rate limiting, and a proper database cache