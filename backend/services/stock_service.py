"""
Stock Service — NSE India focused.
Fetches live quotes and OHLCV history via yfinance.
Duration-aware: period & interval come from signal_service.DURATION_CONFIG.
"""
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import yfinance as yf
from cachetools import TTLCache

from services.nse_stocks import DEFAULT_SYMBOLS, NSE_STOCK_MAP
from services.signal_service import DURATION_CONFIG

logger = logging.getLogger(__name__)

_quote_cache:   TTLCache = TTLCache(maxsize=300, ttl=8)
_history_cache: TTLCache = TTLCache(maxsize=200, ttl=90)


def _safe_float(val):
    if val is None: return None
    try:
        v = float(val)
        return None if (np.isnan(v) or np.isinf(v)) else round(v, 4)
    except: return None


def get_live_quote(symbol: str) -> Dict[str, Any]:
    key = f"q:{symbol}"
    if key in _quote_cache:
        return _quote_cache[key]
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price     = _safe_float(getattr(info, "last_price", None))
        prev      = _safe_float(getattr(info, "previous_close", None))
        open_p    = _safe_float(getattr(info, "open", None))
        day_high  = _safe_float(getattr(info, "day_high", None))
        day_low   = _safe_float(getattr(info, "day_low", None))
        volume    = _safe_float(getattr(info, "last_volume", None))
        mkt_cap   = _safe_float(getattr(info, "market_cap", None))

        if price is None:
            hist = ticker.history(period="1d", interval="5m")
            if not hist.empty:
                price = _safe_float(hist["Close"].iloc[-1])
                if prev is None and len(hist) > 1:
                    prev = _safe_float(hist["Close"].iloc[-2])

        change = pct = None
        if price is not None and prev and prev != 0:
            change = round(price - prev, 4)
            pct    = round((change / prev) * 100, 2)

        meta = NSE_STOCK_MAP.get(symbol, {})
        full = ticker.info or {}
        name   = meta.get("name") or full.get("longName") or full.get("shortName") or symbol
        sector = meta.get("sector") or full.get("sector", "Unknown")
        index  = meta.get("index", "")

        result = {
            "symbol": symbol, "name": name,
            "price": price, "change": change, "change_pct": pct,
            "open": open_p, "day_high": day_high, "day_low": day_low,
            "volume": int(volume) if volume else None,
            "market_cap": mkt_cap,
            "sector": sector, "index": index,
            "currency": "INR",
            "timestamp": datetime.utcnow().isoformat(),
        }
        _quote_cache[key] = result
        return result
    except Exception as e:
        logger.warning("Quote failed %s: %s", symbol, e)
        meta = NSE_STOCK_MAP.get(symbol, {})
        return {"symbol": symbol, "name": meta.get("name", symbol), "price": None,
                "change": None, "change_pct": None, "currency": "INR",
                "sector": meta.get("sector"), "index": meta.get("index"),
                "error": str(e), "timestamp": datetime.utcnow().isoformat()}


def get_historical_data(symbol: str, duration_key: str = "6M") -> Dict[str, Any]:
    cfg = DURATION_CONFIG.get(duration_key, DURATION_CONFIG["6M"])
    period, interval = cfg["period"], cfg["interval"]
    key = f"h:{symbol}:{duration_key}"
    if key in _history_cache:
        return _history_cache[key]
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        if df.empty:
            return {"symbol": symbol, "data": [], "error": "No data"}
        df = df.reset_index()
        df.columns = [c.lower() for c in df.columns]
        date_col = "datetime" if "datetime" in df.columns else "date"
        df.rename(columns={date_col: "date"}, inplace=True)
        if hasattr(df["date"].dtype, "tz") and df["date"].dt.tz is not None:
            df["date"] = df["date"].dt.tz_localize(None)
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%dT%H:%M:%S")
        records = []
        for _, row in df.iterrows():
            records.append({
                "date":   row.get("date"),
                "open":   _safe_float(row.get("open")),
                "high":   _safe_float(row.get("high")),
                "low":    _safe_float(row.get("low")),
                "close":  _safe_float(row.get("close")),
                "volume": int(row["volume"]) if pd.notna(row.get("volume")) else None,
            })
        result = {"symbol": symbol, "duration": duration_key, "period": period,
                  "interval": interval, "data": records, "count": len(records)}
        _history_cache[key] = result
        return result
    except Exception as e:
        logger.error("History failed %s: %s", symbol, e)
        return {"symbol": symbol, "data": [], "error": str(e)}


# Long-term history cache — 6 hour TTL (changes rarely)
_longterm_cache: TTLCache = TTLCache(maxsize=200, ttl=21600)


def get_max_history(symbol: str) -> Dict[str, Any]:
    """
    Fetch ALL available historical weekly data for a symbol using yfinance.
    For NSE stocks listed since 1990s this gives 25-30 years of data.
    Uses weekly interval so the response stays manageable (~1500 rows max).
    """
    key = f"max:{symbol}"
    if key in _longterm_cache:
        return _longterm_cache[key]
    try:
        ticker = yf.Ticker(symbol)
        # period="max" fetches from the very first available date
        df = ticker.history(period="max", interval="1wk")
        if df.empty:
            # fallback to daily for shorter listed stocks
            df = ticker.history(period="max", interval="1d")
        if df.empty:
            return {"symbol": symbol, "data": [], "error": "No data"}

        df = df.reset_index()
        df.columns = [c.lower() for c in df.columns]
        date_col = "datetime" if "datetime" in df.columns else "date"
        df.rename(columns={date_col: "date"}, inplace=True)
        if hasattr(df["date"].dtype, "tz") and df["date"].dt.tz is not None:
            df["date"] = df["date"].dt.tz_localize(None)
        df["date_parsed"] = pd.to_datetime(df["date"])
        df["date"]        = df["date_parsed"].dt.strftime("%Y-%m-%dT%H:%M:%S")
        df["year"]        = df["date_parsed"].dt.year

        records = []
        for _, row in df.iterrows():
            records.append({
                "date":   row.get("date"),
                "open":   _safe_float(row.get("open")),
                "high":   _safe_float(row.get("high")),
                "low":    _safe_float(row.get("low")),
                "close":  _safe_float(row.get("close")),
                "volume": int(row["volume"]) if pd.notna(row.get("volume")) else None,
                "year":   int(row["year"]),
            })

        # Compute deep statistics from full history
        stats = _compute_longterm_stats(df, symbol)

        result = {
            "symbol":      symbol,
            "period":      "max",
            "interval":    "1wk",
            "data":        records,
            "count":       len(records),
            "first_date":  records[0]["date"]  if records else None,
            "last_date":   records[-1]["date"] if records else None,
            "stats":       stats,
        }
        _longterm_cache[key] = result
        return result
    except Exception as e:
        logger.error("Max history failed %s: %s", symbol, e)
        return {"symbol": symbol, "data": [], "error": str(e)}


def _compute_longterm_stats(df: pd.DataFrame, symbol: str) -> Dict[str, Any]:
    """
    Compute comprehensive long-term statistics from full weekly OHLCV DataFrame.
    Returns CAGR, volatility, Sharpe, max drawdown, yearly returns, best/worst periods.
    """
    try:
        close = df["close"].astype(float).dropna()
        if len(close) < 10:
            return {}

        # ── Date range ───────────────────────────────────────
        first_date = df["date_parsed"].iloc[0]
        last_date  = df["date_parsed"].iloc[-1]
        total_years = max((last_date - first_date).days / 365.25, 0.01)
        listing_year = int(first_date.year)

        # ── CAGR ─────────────────────────────────────────────
        first_price = float(close.iloc[0])
        last_price  = float(close.iloc[-1])
        cagr = (last_price / first_price) ** (1 / total_years) - 1 if first_price > 0 else 0

        # ── Weekly returns → annualised volatility ────────────
        weekly_returns = close.pct_change().dropna()
        weekly_vol     = float(weekly_returns.std())
        annual_vol     = weekly_vol * np.sqrt(52)  # 52 weeks/year

        # ── Sharpe ratio (using 6% risk-free rate for India) ──
        risk_free  = 0.06
        sharpe     = (cagr - risk_free) / annual_vol if annual_vol > 0 else 0

        # ── Max Drawdown ─────────────────────────────────────
        rolling_max  = close.cummax()
        drawdown     = (close - rolling_max) / rolling_max
        max_drawdown = float(drawdown.min())

        # ── Yearly returns ────────────────────────────────────
        yearly = {}
        if "year" in df.columns:
            df2 = df.copy()
            df2["close_f"] = df2["close"].astype(float)
            year_groups    = df2.groupby("year")["close_f"]
            year_first     = year_groups.first()
            year_last      = year_groups.last()
            for yr in sorted(year_first.index):
                f = year_first[yr]
                l = year_last[yr]
                if f and f > 0:
                    yearly[int(yr)] = round((l - f) / f * 100, 2)

        best_year  = max(yearly.items(), key=lambda x: x[1]) if yearly else None
        worst_year = min(yearly.items(), key=lambda x: x[1]) if yearly else None

        # ── Positive vs Negative years ─────────────────────────
        pos_years  = sum(1 for v in yearly.values() if v > 0)
        neg_years  = sum(1 for v in yearly.values() if v <= 0)
        win_rate   = pos_years / len(yearly) * 100 if yearly else 0

        # ── Rolling 1Y / 3Y / 5Y returns (latest) ────────────
        def rolling_return(n_weeks):
            if len(close) < n_weeks:
                return None
            p0 = float(close.iloc[-n_weeks])
            p1 = float(close.iloc[-1])
            yrs = n_weeks / 52
            return round((p1 / p0) ** (1 / yrs) - 1, 4) if p0 > 0 else None

        return {
            "listing_year":   listing_year,
            "total_years":    round(total_years, 1),
            "first_price":    round(first_price, 2),
            "last_price":     round(last_price, 2),
            "total_return_pct": round((last_price - first_price) / first_price * 100, 2) if first_price > 0 else 0,
            "cagr":           round(cagr, 6),
            "cagr_pct":       round(cagr * 100, 2),
            "annual_vol":     round(annual_vol, 6),
            "annual_vol_pct": round(annual_vol * 100, 2),
            "sharpe":         round(sharpe, 2),
            "max_drawdown_pct": round(max_drawdown * 100, 2),
            "win_rate_pct":   round(win_rate, 1),
            "pos_years":      pos_years,
            "neg_years":      neg_years,
            "yearly_returns": yearly,
            "best_year":      {"year": best_year[0],  "return_pct": best_year[1]}  if best_year  else None,
            "worst_year":     {"year": worst_year[0], "return_pct": worst_year[1]} if worst_year else None,
            "cagr_1y":        rolling_return(52),
            "cagr_3y":        rolling_return(156),
            "cagr_5y":        rolling_return(260),
            "cagr_10y":       rolling_return(520),
            "data_points":    len(close),
        }
    except Exception as e:
        logger.warning("Longterm stats failed %s: %s", symbol, e)
        return {}


async def get_max_history_async(symbol: str) -> Dict[str, Any]:
    """Async wrapper for max history fetch."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_max_history, symbol)


async def get_live_quote_async(symbol: str) -> Dict[str, Any]:
    """Async wrapper for live quote fetch."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_live_quote, symbol)


async def get_historical_data_async(symbol: str, duration_key: str = "6M") -> Dict[str, Any]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_historical_data, symbol, duration_key)


async def get_all_quotes_async(symbols: List[str]) -> List[Dict[str, Any]]:
    tasks = [get_live_quote_async(s) for s in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if isinstance(r, dict)]
