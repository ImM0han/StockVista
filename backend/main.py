"""
StockPulse API — NSE India Edition
FastAPI + WebSocket backend with duration-aware signals.
"""
import asyncio, json, logging, time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Set

import uvicorn
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from services.indicator_service import compute_indicators
from services.signal_service import generate_signal, DURATION_CONFIG
from services.stock_service import (
    DEFAULT_SYMBOLS, get_all_quotes_async,
    get_historical_data_async, get_live_quote_async,
    get_max_history_async,
)
from services.nse_stocks import NSE_STOCKS, ALL_NSE_SYMBOLS, SECTORS, INDICES, NSE_STOCK_MAP

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self): self._active: Set[WebSocket] = set()
    async def connect(self, ws):
        await ws.accept(); self._active.add(ws)
        logger.info("WS +1 total=%d", len(self._active))
    def disconnect(self, ws): self._active.discard(ws)
    async def broadcast(self, data):
        if not self._active: return
        payload = json.dumps(data)
        dead = set()
        for ws in list(self._active):
            try: await ws.send_text(payload)
            except: dead.add(ws)
        for ws in dead: self._active.discard(ws)
    async def send_personal(self, ws, data):
        try: await ws.send_text(json.dumps(data))
        except Exception as e: logger.warning("send failed: %s", e)
    @property
    def count(self): return len(self._active)

manager = ConnectionManager()
_task = None

async def _broadcast_loop():
    while True:
        try:
            if manager.count > 0:
                quotes = await get_all_quotes_async(DEFAULT_SYMBOLS[:20])
                await manager.broadcast({"type": "quotes", "data": quotes, "ts": time.time()})
        except Exception as e:
            logger.error("broadcast: %s", e)
        await asyncio.sleep(4)

@asynccontextmanager
async def lifespan(app):
    global _task
    _task = asyncio.create_task(_broadcast_loop())
    yield
    if _task: _task.cancel()

app = FastAPI(title="StockPulse NSE API", version="2.0.0", lifespan=lifespan)
import os

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health(): return {"status": "ok", "ws_clients": manager.count}


@app.get("/stocks")
async def list_stocks(
    index: str  = Query(default="NIFTY 50"),
    sector: str = Query(default="All"),
    limit: int  = Query(default=50, le=200),
):
    if index == "All":
        syms = ALL_NSE_SYMBOLS[:limit]
    else:
        syms = [s["symbol"] for s in NSE_STOCKS if s["index"] == index][:limit]
    if sector != "All":
        meta_syms = {s["symbol"] for s in NSE_STOCKS if s["sector"] == sector}
        syms = [s for s in syms if s in meta_syms]
    data = await get_all_quotes_async(syms)
    return {"data": data, "count": len(data), "index": index, "sector": sector}


@app.get("/stocks/meta")
async def stocks_meta(): return {"sectors": SECTORS, "indices": INDICES, "total": len(ALL_NSE_SYMBOLS)}


@app.get("/stock/{symbol}")
async def get_stock(symbol: str, duration: str = Query(default="6M")):
    symbol = symbol.upper()
    if duration not in DURATION_CONFIG:
        raise HTTPException(400, f"Invalid duration. Use: {list(DURATION_CONFIG.keys())}")
    q_task = get_live_quote_async(symbol)
    h_task = get_historical_data_async(symbol, duration)
    quote, history = await asyncio.gather(q_task, h_task)
    if history.get("error") and not history.get("data"):
        raise HTTPException(404, f"No data for {symbol}")
    indicators = compute_indicators(history, duration)
    signal = generate_signal(indicators, duration)
    meta = NSE_STOCK_MAP.get(symbol, {})
    return {"symbol": symbol, "quote": quote, "history": history,
            "indicators": indicators, "signal": signal, "meta": meta,
            "duration": duration}


@app.get("/stock/{symbol}/analysis")
async def get_stock_analysis(symbol: str):
    """
    GET /stock/{symbol}/analysis
    Returns full long-term history (max period, weekly bars) with
    deep statistics: CAGR, volatility, Sharpe, max drawdown,
    yearly returns, best/worst year — from IPO date to today.
    Used by the Investment Calculator for reliable projections.
    """
    symbol = symbol.upper()
    data   = await get_max_history_async(symbol)
    if data.get("error") and not data.get("data"):
        raise HTTPException(status_code=404, detail=f"No long-term data for {symbol}")
    return data


@app.get("/signal/{symbol}")
async def get_signal(symbol: str, duration: str = Query(default="6M")):
    symbol = symbol.upper()
    if duration not in DURATION_CONFIG:
        raise HTTPException(400, f"Invalid duration")
    history = await get_historical_data_async(symbol, duration)
    indicators = compute_indicators(history, duration)
    signal = generate_signal(indicators, duration)
    return {"symbol": symbol, "duration": duration, "signal": signal}


@app.get("/search")
async def search(q: str = Query(...)):
    term = q.strip().upper()
    # Exact symbol match
    if term in NSE_STOCK_MAP:
        quote = await get_live_quote_async(term)
        return {"results": [{"symbol": term, "meta": NSE_STOCK_MAP[term], "quote": quote}]}
    # Partial name/symbol match
    matches = [
        s for s in NSE_STOCKS
        if term in s["symbol"] or term.lower() in s["name"].lower()
    ][:10]
    quotes = await get_all_quotes_async([m["symbol"] for m in matches])
    q_map = {q["symbol"]: q for q in quotes}
    return {"results": [{"symbol": m["symbol"], "meta": m, "quote": q_map.get(m["symbol"])} for m in matches]}


@app.websocket("/ws/stocks")
async def ws_stocks(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        quotes = await get_all_quotes_async(DEFAULT_SYMBOLS[:20])
        await manager.send_personal(websocket, {"type": "quotes", "data": quotes, "ts": time.time()})
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=60)
                msg = json.loads(raw)
                if msg.get("type") == "ping":
                    await manager.send_personal(websocket, {"type": "pong"})
                elif msg.get("type") == "subscribe":
                    syms = [s.upper() for s in msg.get("symbols", [])]
                    if syms:
                        extra = await get_all_quotes_async(syms)
                        await manager.send_personal(websocket, {"type": "quotes", "data": extra, "ts": time.time()})
            except asyncio.TimeoutError:
                await manager.send_personal(websocket, {"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error("WS error: %s", e)
        manager.disconnect(websocket)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
