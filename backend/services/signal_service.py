"""
Duration-Aware Signal Service
==============================
Each duration uses different indicator parameters and thresholds
to produce genuinely meaningful BUY / SELL / HOLD signals.

Duration → yfinance params:
  1W  → period=5d,  interval=15m  → fast indicators (RSI-7,  MACD 5/13/4)
  1M  → period=1mo, interval=1d   → medium (RSI-14, MACD 8/21/5)
  6M  → period=6mo, interval=1d   → standard (RSI-14, MACD 12/26/9)
  1Y  → period=1y,  interval=1wk  → slow (RSI-21, MACD 26/52/9)
"""

import logging
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

DURATION_CONFIG = {
    "1W": {
        "label": "1 Week", "period": "5d", "interval": "15m",
        "rsi_period": 7, "macd_fast": 5, "macd_slow": 13, "macd_signal": 4,
        "ma_short": 9, "ma_long": 21, "trend_window": 20,
        "rsi_oversold": 35, "rsi_overbought": 65,
        "description": "Short-term momentum trading signal",
    },
    "1M": {
        "label": "1 Month", "period": "1mo", "interval": "1d",
        "rsi_period": 14, "macd_fast": 8, "macd_slow": 21, "macd_signal": 5,
        "ma_short": 10, "ma_long": 30, "trend_window": 15,
        "rsi_oversold": 30, "rsi_overbought": 70,
        "description": "Short-term swing trading signal",
    },
    "6M": {
        "label": "6 Months", "period": "6mo", "interval": "1d",
        "rsi_period": 14, "macd_fast": 12, "macd_slow": 26, "macd_signal": 9,
        "ma_short": 50, "ma_long": 100, "trend_window": 30,
        "rsi_oversold": 30, "rsi_overbought": 70,
        "description": "Medium-term positional signal",
    },
    "1Y": {
        "label": "1 Year", "period": "1y", "interval": "1wk",
        "rsi_period": 21, "macd_fast": 26, "macd_slow": 52, "macd_signal": 9,
        "ma_short": 13, "ma_long": 26, "trend_window": 20,
        "rsi_oversold": 28, "rsi_overbought": 72,
        "description": "Long-term investment signal",
    },
}


def _safe_float(v):
    try:
        f = float(v)
        return None if (np.isnan(f) or np.isinf(f)) else round(f, 6)
    except Exception:
        return None


def _last_valid(lst, n=1):
    clean = [v for v in lst if v is not None]
    return clean[-n] if len(clean) >= n else None


def _safe_series(series):
    return [_safe_float(v) for v in series]


def compute_rsi(close, period):
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def compute_macd(close, fast, slow, signal):
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    return macd_line, signal_line, macd_line - signal_line


def compute_bollinger(close, window=20, num_std=2.0):
    w = min(window, max(5, len(close) // 3))
    sma = close.rolling(w).mean()
    std = close.rolling(w).std()
    return sma + num_std * std, sma, sma - num_std * std


def compute_all_indicators(df, config):
    if df.empty or len(df) < 5:
        return {}
    close = df["close"].astype(float)
    volume = df["volume"].astype(float) if "volume" in df.columns else pd.Series(dtype=float)
    high = df["high"].astype(float) if "high" in df.columns else close
    low = df["low"].astype(float) if "low" in df.columns else close
    dates = df["date"].tolist() if "date" in df.columns else list(range(len(df)))

    result = {"dates": dates, "close": _safe_series(close)}

    rsi = compute_rsi(close, config["rsi_period"])
    result["rsi"] = _safe_series(rsi)

    macd_line, sig_line, hist = compute_macd(
        close, config["macd_fast"], config["macd_slow"], config["macd_signal"]
    )
    result["macd"] = _safe_series(macd_line)
    result["macd_signal"] = _safe_series(sig_line)
    result["macd_diff"] = _safe_series(hist)

    result["ma_short"] = _safe_series(close.ewm(span=config["ma_short"], adjust=False).mean())
    result["ma_long"]  = _safe_series(close.ewm(span=config["ma_long"],  adjust=False).mean())

    if len(close) >= 100:
        result["ma200"] = _safe_series(close.rolling(min(200, len(close))).mean())
    else:
        result["ma200"] = [None] * len(close)

    bu, bm, bl = compute_bollinger(close)
    result["bb_upper"] = _safe_series(bu)
    result["bb_middle"] = _safe_series(bm)
    result["bb_lower"] = _safe_series(bl)

    if not volume.empty:
        result["volume"] = [int(v) if pd.notna(v) else None for v in volume]
        vol_w = min(20, max(5, len(volume) // 5))
        result["volume_sma"] = _safe_series(volume.rolling(vol_w).mean())
    else:
        result["volume"] = []
        result["volume_sma"] = []

    tr = pd.concat([(high - low), (high - close.shift()).abs(), (low - close.shift()).abs()], axis=1).max(axis=1)
    result["atr"] = _safe_series(tr.ewm(span=14, adjust=False).mean())

    return result


def _score_rsi(rsi_series, config):
    rsi = _last_valid(rsi_series)
    if rsi is None:
        return 0.0, "RSI: No data"
    os, ob = config["rsi_oversold"], config["rsi_overbought"]
    mid = (os + ob) / 2
    if rsi <= os - 10:  return 2.0,  f"RSI {rsi:.1f} — Extremely oversold"
    elif rsi <= os:     return 1.5,  f"RSI {rsi:.1f} — Oversold zone"
    elif rsi <= mid-5:  return 0.5,  f"RSI {rsi:.1f} — Mild bullish"
    elif rsi >= ob+10:  return -2.0, f"RSI {rsi:.1f} — Extremely overbought"
    elif rsi >= ob:     return -1.5, f"RSI {rsi:.1f} — Overbought zone"
    elif rsi >= mid+5:  return -0.5, f"RSI {rsi:.1f} — Mild bearish"
    else:               return 0.0,  f"RSI {rsi:.1f} — Neutral"


def _score_macd(macd, signal, hist):
    if len(macd) < 3:
        return 0.0, "MACD: Insufficient data"
    m_now, s_now = _last_valid(macd), _last_valid(signal)
    m_prev, s_prev = _last_valid(macd, 2), _last_valid(signal, 2)
    h_now, h_prev = _last_valid(hist), _last_valid(hist, 2)
    if any(v is None for v in [m_now, s_now, m_prev, s_prev]):
        return 0.0, "MACD: No data"
    cur_bull = m_now > s_now
    prev_bull = m_prev > s_prev
    if not prev_bull and cur_bull:
        return 2.0 if (h_now and h_now > 0) else 1.5, "MACD bullish crossover"
    if prev_bull and not cur_bull:
        return -2.0 if (h_now and h_now < 0) else -1.5, "MACD bearish crossover"
    inc = (h_now > h_prev) if (h_now is not None and h_prev is not None) else (m_now > s_now)
    if cur_bull and inc:   return 0.8, "MACD above signal, momentum rising"
    elif cur_bull:         return 0.3, "MACD above signal, momentum slowing"
    elif not cur_bull and not inc: return -0.8, "MACD below signal, momentum falling"
    else:                  return -0.3, "MACD below signal, recovering"


def _score_ma(close, ma_short, ma_long):
    c, ms, ml = _last_valid(close), _last_valid(ma_short), _last_valid(ma_long)
    ms_p, ml_p = _last_valid(ma_short, 2), _last_valid(ma_long, 2)
    if c is None:
        return 0.0, "MA: No data"
    score, notes = 0.0, []
    if ms: score += 0.5 if c > ms else -0.5; notes.append("price > MA-short" if c > ms else "price < MA-short")
    if ml: score += 0.5 if c > ml else -0.5; notes.append("price > MA-long" if c > ml else "price < MA-long")
    if ms and ml and ms_p and ml_p:
        if ms > ml and ms_p <= ml_p: score += 1.0; notes.append("Golden cross")
        elif ms < ml and ms_p >= ml_p: score -= 1.0; notes.append("Death cross")
    return max(-2.0, min(2.0, score)), " | ".join(notes) or "MA: Neutral"


def _score_trend(close, window):
    clean = [v for v in close if v is not None]
    n = min(window, len(clean))
    if n < 5:
        return 0.0, "Trend: Insufficient data"
    y = np.array(clean[-n:])
    slope, _ = np.polyfit(np.arange(n), y, 1)
    base = y[0] if y[0] != 0 else 1
    pct = (slope * n / base) * 100
    if pct > 10:   return 2.0,  f"Strong uptrend (+{pct:.1f}%)"
    elif pct > 4:  return 1.0,  f"Moderate uptrend (+{pct:.1f}%)"
    elif pct > 1:  return 0.4,  f"Mild uptrend (+{pct:.1f}%)"
    elif pct < -10:return -2.0, f"Strong downtrend ({pct:.1f}%)"
    elif pct < -4: return -1.0, f"Moderate downtrend ({pct:.1f}%)"
    elif pct < -1: return -0.4, f"Mild downtrend ({pct:.1f}%)"
    else:          return 0.0,  f"Sideways ({pct:.1f}%)"


def _score_bollinger(close, bb_upper, bb_lower, bb_middle):
    c, bu, bl, bm = _last_valid(close), _last_valid(bb_upper), _last_valid(bb_lower), _last_valid(bb_middle)
    if any(v is None for v in [c, bu, bl, bm]):
        return 0.0, "BB: No data"
    bw = bu - bl
    if bw <= 0: return 0.0, "BB: Zero bandwidth"
    pos = (c - bl) / bw
    if pos <= 0.08:   return 1.8,  "Price at lower BB — bounce expected"
    elif pos <= 0.2:  return 0.8,  "Price near lower BB — oversold"
    elif pos >= 0.92: return -1.8, "Price at upper BB — reversal risk"
    elif pos >= 0.8:  return -0.8, "Price near upper BB — overbought"
    elif pos > 0.6:   return -0.2, "Above BB midline"
    elif pos < 0.4:   return 0.2,  "Below BB midline"
    else:             return 0.0,  "BB: Neutral"


def _estimate_hold(close, atr, duration_key):
    clean = [v for v in close if v is not None]
    if len(clean) < 5:
        return {}
    current = clean[-1]
    window = min(20, len(clean))
    y = np.array(clean[-window:])
    x = np.arange(len(y))
    slope, intercept = np.polyfit(x, y, 1)
    fwd = {"1W": 5, "1M": 10, "6M": 20, "1Y": 8}.get(duration_key, 10)
    projected = float(np.polyval([slope, intercept], len(y) + fwd))
    ret_pct = ((projected - current) / current) * 100 if current else 0
    atr_val = _last_valid(atr)
    if atr_val and current:
        bars = max(2, int((current * 0.05) / max(atr_val, 0.01)))
        hold_bars = min(bars, fwd * 2)
    else:
        hold_bars = fwd
    bar_days = {"1W": 0.25, "1M": 1, "6M": 1, "1Y": 5}.get(duration_key, 1)
    hold_days = max(1, int(hold_bars * bar_days))
    return {
        "estimated_return_pct": round(ret_pct, 2),
        "holding_period_days": hold_days,
        "holding_period_label": f"{hold_days}d" if hold_days < 30 else f"{hold_days // 30}mo",
    }


def generate_signal(indicators, duration_key="6M"):
    if not indicators or not indicators.get("close"):
        return {"signal": "UNKNOWN", "confidence": 0, "duration": duration_key}

    config = DURATION_CONFIG.get(duration_key, DURATION_CONFIG["6M"])

    rsi_s,   rsi_n   = _score_rsi(indicators.get("rsi", []), config)
    macd_s,  macd_n  = _score_macd(indicators.get("macd", []), indicators.get("macd_signal", []), indicators.get("macd_diff", []))
    ma_s,    ma_n    = _score_ma(indicators.get("close", []), indicators.get("ma_short", []), indicators.get("ma_long", []))
    tr_s,    tr_n    = _score_trend(indicators.get("close", []), config["trend_window"])
    bb_s,    bb_n    = _score_bollinger(indicators.get("close", []), indicators.get("bb_upper", []), indicators.get("bb_lower", []), indicators.get("bb_middle", []))

    scores = {"RSI": round(rsi_s, 2), "MACD": round(macd_s, 2), "MA Cross": round(ma_s, 2), "Trend": round(tr_s, 2), "Bollinger": round(bb_s, 2)}
    reasons = {"RSI": rsi_n, "MACD": macd_n, "MA Cross": ma_n, "Trend": tr_n, "Bollinger": bb_n}

    total = sum(scores.values())
    confidence = round(min(100, (abs(total) / 10.0) * 100), 1)

    thr = {"1W": (3.0, 1.5, -3.0, -1.5), "1M": (2.5, 1.0, -2.5, -1.0), "6M": (2.5, 1.0, -2.5, -1.0), "1Y": (2.0, 0.8, -2.0, -0.8)}.get(duration_key, (2.5, 1.0, -2.5, -1.0))

    if total >= thr[0]:    signal, color = "STRONG BUY",  "#00ff88"
    elif total >= thr[1]:  signal, color = "BUY",          "#22c55e"
    elif total <= thr[2]:  signal, color = "STRONG SELL",  "#ff2244"
    elif total <= thr[3]:  signal, color = "SELL",         "#ef4444"
    else:                  signal, color = "HOLD",         "#f59e0b"

    buy_n  = sum(1 for v in scores.values() if v > 0.3)
    sell_n = sum(1 for v in scores.values() if v < -0.3)
    hold_n = len(scores) - buy_n - sell_n
    n = len(scores)

    result = {
        "signal": signal, "color": color,
        "total_score": round(total, 2), "confidence": confidence,
        "duration": duration_key, "duration_label": config["label"],
        "description": config["description"],
        "scores": scores, "reasons": reasons,
        "pie": {"buy_pct": round(buy_n/n*100, 1), "hold_pct": round(hold_n/n*100, 1), "sell_pct": round(sell_n/n*100, 1)},
        "snapshot": {
            "rsi": _last_valid(indicators.get("rsi", [])),
            "macd": _last_valid(indicators.get("macd", [])),
            "macd_signal": _last_valid(indicators.get("macd_signal", [])),
            "ma_short": _last_valid(indicators.get("ma_short", [])),
            "ma_long": _last_valid(indicators.get("ma_long", [])),
            "price": _last_valid(indicators.get("close", [])),
        },
    }
    if signal == "HOLD":
        result.update(_estimate_hold(indicators.get("close", []), indicators.get("atr", []), duration_key))
    return result
