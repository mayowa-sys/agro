"""
Forecast logic — loads trained Prophet models and generates predictions.
Falls back to cohort baseline if insufficient personal transaction history.
"""
import os
import pickle
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import pandas as pd
from prophet import Prophet

MODEL_DIR = "models"
MODEL_VERSION = "v1.0.0"

_model_cache: Dict[str, Prophet] = {}

def load_model(crop_type: str) -> Prophet:
    key = crop_type.upper()
    if key not in _model_cache:
        path = os.path.join(MODEL_DIR, f"prophet_{key.lower()}.pkl")
        if not os.path.exists(path):
            raise FileNotFoundError(f"No model for crop {crop_type}. Run training first.")
        with open(path, "rb") as f:
            _model_cache[key] = pickle.load(f)
    return _model_cache[key]


def forecast(
    farmer_id: str,
    crop_type: str,
    region: str,
    planting_date: Optional[str],
    expected_harvest_date: Optional[str],
    transaction_history: List[Dict[str, Any]],
    horizon_days: int = 90,
) -> Dict[str, Any]:
    model = load_model(crop_type)

    # Build future dataframe from today
    today = datetime.utcnow().replace(tzinfo=None)
    future_dates = pd.date_range(start=today, periods=horizon_days, freq="D")
    future_df = pd.DataFrame({"ds": future_dates})

    # If we have enough personal history (>=30 days), fine-tune with it
    if len(transaction_history) >= 30:
        personal_rows = []
        for t in transaction_history:
            if t.get("type") == "CREDIT":
                personal_rows.append({
                    "ds": pd.to_datetime(t["date"]).replace(tzinfo=None),
                    "y": float(t["amount"]) / 100,
                })
        if personal_rows:
            personal_df = pd.DataFrame(personal_rows)
            personal_df["ds"] = pd.to_datetime(personal_df["ds"]).dt.to_period("W").apply(lambda r: r.start_time)
            personal_df = personal_df.groupby("ds")["y"].sum().reset_index()
            personal_model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=False,
                daily_seasonality=False,
                seasonality_mode="multiplicative",
                interval_width=0.80,
            )
            personal_model.fit(personal_df)
            forecast_df = personal_model.predict(future_df)
        else:
            forecast_df = model.predict(future_df)
    else:
        forecast_df = model.predict(future_df)

    # Build events list
    events = []
    for _, row in forecast_df.iterrows():
        yhat = max(0, row["yhat"])
        yhat_lower = max(0, row["yhat_lower"])
        yhat_upper = max(0, row["yhat_upper"])

        if yhat < 500:  # Skip near-zero days
            continue

        # Determine type from trend
        is_income = yhat > 5_000  # ₦5k threshold

        reasons = _build_reasons(crop_type, row["ds"], yhat, planting_date, expected_harvest_date)

        events.append({
            "date": row["ds"].isoformat(),
            "amount": int(yhat * 100),  # naira → kobo
            "amount_lower": int(yhat_lower * 100),
            "amount_upper": int(yhat_upper * 100),
            "type": "INCOME" if is_income else "EXPENSE",
            "category": "HARVEST_PAYMENT" if is_income else "HOUSEHOLD",
            "confidence": float(_confidence(yhat_lower, yhat, yhat_upper)),
            "reasons": reasons,
        })

    # Detect cash gaps
    cash_gaps = _detect_cash_gaps(events, today)

    return {
        "farmer_id": farmer_id,
        "model_version": MODEL_VERSION,
        "generated_at": today.isoformat(),
        "horizon_days": horizon_days,
        "events": events,
        "cash_gaps": cash_gaps,
    }


def _confidence(lower: float, yhat: float, upper: float) -> float:
    if upper == lower:
        return 1.0
    return max(0.0, min(1.0, 1 - (upper - lower) / (yhat + 1)))


def _build_reasons(crop_type: str, date: datetime, amount: float, planting_date: Optional[str], harvest_date: Optional[str]) -> List[str]:
    reasons = []
    month = date.month

    crop_reasons = {
        "YAM": ["Yam harvest season typically peaks Nov–Jan in Benue", "Post-harvest buyer demand drives prices up", "Seasonal pattern from Yam Cycle playbook"],
        "CASSAVA": ["Cassava has two harvest windows mid and late season", "Starch processing demand is consistent", "Regional market data supports this projection"],
        "TOMATO": ["Tomato glut risk in peak rainy season", "Volatile pricing — confidence interval is wide", "Multiple short harvest cycles expected"],
        "MAIZE": ["Maize harvest aligns with dry season onset", "Strong off-taker demand in month 4–5", "Maize Sprint playbook pattern"],
        "RICE": ["Rice harvest concentrated in month 7–8", "Wet season growing pattern followed", "Rice Surge playbook applied"],
        "COCOA": ["Cocoa has two main crop seasons", "Export demand supports stable pricing", "Cocoa Lag playbook — payments trail harvest by 4–6 weeks"],
    }

    reasons = crop_reasons.get(crop_type.upper(), ["Seasonal pattern detected", "Historical cohort data applied", "Regional market trends considered"])
    return reasons[:3]


def _detect_cash_gaps(events: List[Dict], today: datetime) -> List[Dict[str, Any]]:
    gaps = []
    running = 0
    gap_start = None

    for event in events:
        if event["type"] == "INCOME":
            running += event["amount"]
        else:
            running -= event["amount"]

        if running < 0 and gap_start is None:
            gap_start = event["date"]
        elif running >= 0 and gap_start is not None:
            gaps.append({
                "start_date": gap_start,
                "end_date": event["date"],
                "gap_amount_kobo": abs(running),
                "status": "PREDICTED",
            })
            gap_start = None

    return gaps


def stress_test(
    crop_type: str,
    scenario: str,
    transaction_history: List[Dict[str, Any]],
    horizon_days: int = 90,
) -> Dict[str, Any]:
    base = forecast(
        farmer_id="stress-test",
        crop_type=crop_type,
        region="Nigeria",
        planting_date=None,
        expected_harvest_date=None,
        transaction_history=transaction_history,
        horizon_days=horizon_days,
    )

    events = base["events"]

    if scenario == "drought":
        events = [{**e, "amount": int(e["amount"] * 0.55),
                   "amount_lower": int(e["amount_lower"] * 0.4),
                   "amount_upper": int(e["amount_upper"] * 0.7)} if e["type"] == "INCOME" else e for e in events]
    elif scenario == "price_crash":
        events = [{**e, "amount": int(e["amount"] * 0.7)} if e["type"] == "INCOME" else e for e in events]
    elif scenario == "late_buyer":
        shifted = []
        for e in events:
            if e["type"] == "INCOME":
                new_date = (datetime.fromisoformat(e["date"]) + timedelta(days=30)).isoformat()
                shifted.append({**e, "date": new_date})
            else:
                shifted.append(e)
        events = shifted
    elif scenario == "late_harvest_3wk":
        shifted = []
        for e in events:
            if e["category"] == "HARVEST_PAYMENT":
                new_date = (datetime.fromisoformat(e["date"]) + timedelta(days=21)).isoformat()
                shifted.append({**e, "date": new_date})
            else:
                shifted.append(e)
        events = shifted

    base["events"] = events
    base["cash_gaps"] = _detect_cash_gaps(events, datetime.utcnow())
    base["scenario"] = scenario
    return base
