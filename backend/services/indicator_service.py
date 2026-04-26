"""
Indicator Service — thin adapter between stock_service and signal_service.
Converts raw OHLCV records → DataFrame → calls signal_service.compute_all_indicators.
"""
import pandas as pd
from typing import Any, Dict
from services.signal_service import compute_all_indicators, DURATION_CONFIG


def compute_indicators(history_data: Dict[str, Any], duration_key: str = "6M") -> Dict[str, Any]:
    records = history_data.get("data", [])
    if not records:
        return {}
    df = pd.DataFrame(records)
    if df.empty or "close" not in df.columns:
        return {}
    config = DURATION_CONFIG.get(duration_key, DURATION_CONFIG["6M"])
    return compute_all_indicators(df, config)
