"""
Forecast logic — loads trained Prophet models and generates predictions.
Income is clustered around harvest window; expenses are injected from crop cycle.
"""
import os
import pickle
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import pandas as pd
from prophet import Prophet

MODEL_DIR = "models"
MODEL_VERSION = "v1.1.0"

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


def _parse_date(d):
    if isinstance(d, datetime):
        return d.replace(tzinfo=None)
    return datetime.fromisoformat(str(d).replace("Z", "")).replace(tzinfo=None)


def _confidence(lower: float, yhat: float, upper: float) -> float:
    if upper == lower:
        return 1.0
    return max(0.0, min(1.0, 1 - (upper - lower) / (yhat + 1)))


def _build_reasons(crop_type: str, date: datetime, amount: float, planting_date, harvest_date) -> List[str]:
    crop_reasons = {
        "YAM": ["Yam harvest season typically peaks Nov–Jan in Benue", "Post-harvest buyer demand drives prices up", "Seasonal pattern from Yam Cycle playbook"],
        "CASSAVA": ["Cassava has two harvest windows mid and late season", "Starch processing demand is consistent", "Regional market data supports this projection"],
        "TOMATO": ["Tomato glut risk in peak rainy season", "Volatile pricing — confidence interval is wide", "Multiple short harvest cycles expected"],
        "MAIZE": ["Maize harvest aligns with dry season onset", "Strong off-taker demand in month 4–5", "Maize Sprint playbook pattern"],
        "RICE": ["Rice harvest concentrated in month 7–8", "Wet season growing pattern followed", "Rice Surge playbook applied"],
        "COCOA": ["Cocoa has two main crop seasons", "Export demand supports stable pricing", "Cocoa Lag playbook — payments trail harvest by 4–6 weeks"],
    }
    return crop_reasons.get(crop_type.upper(), ["Seasonal pattern detected", "Historical cohort data applied", "Regional market trends considered"])[:3]


def _generate_income_events(crop_type, today, horizon_days, planting_date, expected_harvest_date, forecast_df):
    """Cluster income around harvest window only — not spread daily."""
    events = []
    try:
        harvest_dt = _parse_date(expected_harvest_date) if expected_harvest_date else today + timedelta(days=150)
    except Exception:
        harvest_dt = today + timedelta(days=150)

    # Estimate harvest magnitude from crop profile, anchored by Prophet's predicted peak
    # Cap at realistic values for a single smallholder yam harvest (₦400k–₦1.2M typical)
    crop_floors = {
        "YAM": 600_000, "CASSAVA": 350_000, "TOMATO": 450_000,
        "MAIZE": 400_000, "RICE": 500_000, "COCOA": 800_000,
    }
    crop_caps = {
        "YAM": 1_400_000, "CASSAVA": 800_000, "TOMATO": 1_000_000,
        "MAIZE": 900_000, "RICE": 1_100_000, "COCOA": 1_800_000,
    }
    crop = crop_type.upper()
    floor = crop_floors.get(crop, 400_000)
    cap = crop_caps.get(crop, 1_200_000)
    # Use Prophet's peak (not mean) as a magnitude signal, but cap aggressively
    peak = float(forecast_df["yhat"].clip(lower=0).max()) if len(forecast_df) else floor
    total_harvest_naira = max(floor, min(cap, peak * 3))

    days_to_harvest = (harvest_dt - today).days

    if 0 < days_to_harvest <= horizon_days:
        # Main tranche on harvest date (60%)
        reasons = _build_reasons(crop_type, harvest_dt, total_harvest_naira * 0.6, planting_date, expected_harvest_date)
        events.append({
            "date": harvest_dt.isoformat(),
            "amount": int(total_harvest_naira * 0.6 * 100),
            "amount_lower": int(total_harvest_naira * 0.4 * 100),
            "amount_upper": int(total_harvest_naira * 0.85 * 100),
            "type": "INCOME",
            "category": "HARVEST_PAYMENT",
            "confidence": 0.75,
            "reasons": reasons,
        })
        # Second tranche 2 weeks later (40%)
        second = harvest_dt + timedelta(days=14)
        if (second - today).days <= horizon_days:
            events.append({
                "date": second.isoformat(),
                "amount": int(total_harvest_naira * 0.4 * 100),
                "amount_lower": int(total_harvest_naira * 0.25 * 100),
                "amount_upper": int(total_harvest_naira * 0.6 * 100),
                "type": "INCOME",
                "category": "HARVEST_PAYMENT",
                "confidence": 0.60,
                "reasons": [f"{crop_type.upper()} harvest — second tranche", "Remaining balance from buyer, delayed 2 weeks"],
            })
    # If harvest beyond horizon: no income events → expenses create gap (intentional)
    return events


def _generate_expense_events(crop_type, today, horizon_days, planting_date, expected_harvest_date):
    """Inject realistic expense events: weekly household + crop-cycle spikes."""
    events = []
    crop = crop_type.upper()

    # Weekly household expenses ₦12,000/week
    for week in range(horizon_days // 7 + 1):
        date = today + timedelta(days=week * 7 + 2)
        if (date - today).days >= horizon_days:
            break
        events.append({
            "date": date.isoformat(),
            "amount": 12_000 * 100,
            "amount_lower": 9_600 * 100,
            "amount_upper": 14_400 * 100,
            "type": "EXPENSE",
            "category": "HOUSEHOLD",
            "confidence": 0.85,
            "reasons": ["Recurring weekly household spend"],
        })

    try:
        if planting_date:
            pd_dt = _parse_date(planting_date)
            for offset, amt, label, cat in [
                (20, 45_000, "Fertilizer application ~20 days after planting", "INPUTS"),
                (30, 35_000, "Weeding labour ~30 days after planting", "LABOUR"),
                (60, 30_000, "Second weeding pass ~60 days after planting", "LABOUR"),
            ]:
                d = pd_dt + timedelta(days=offset)
                if today <= d <= today + timedelta(days=horizon_days):
                    events.append({
                        "date": d.isoformat(),
                        "amount": amt * 100,
                        "amount_lower": int(amt * 0.75) * 100,
                        "amount_upper": int(amt * 1.3) * 100,
                        "type": "EXPENSE",
                        "category": cat,
                        "confidence": 0.8,
                        "reasons": [label, f"{crop} cycle"],
                    })

        if expected_harvest_date:
            hd_dt = _parse_date(expected_harvest_date)
            d = hd_dt - timedelta(days=7)
            if today <= d <= today + timedelta(days=horizon_days):
                events.append({
                    "date": d.isoformat(),
                    "amount": 80_000 * 100,
                    "amount_lower": 60_000 * 100,
                    "amount_upper": 110_000 * 100,
                    "type": "EXPENSE",
                    "category": "LABOUR",
                    "confidence": 0.88,
                    "reasons": ["Harvest labour spike — peak workforce need"],
                })
    except Exception:
        pass

    return events



def _build_balance_series(events, today, horizon_days):
    """Build a daily running balance series in kobo. Returns list of {day, date, balance_kobo}."""
    from datetime import timedelta
    by_day = {}
    for e in events:
        try:
            ed = _parse_date(e["date"])
        except Exception:
            continue
        day_offset = (ed.date() - today.date()).days
        if day_offset < 0 or day_offset > horizon_days:
            continue
        delta = e["amount"] if e["type"] == "INCOME" else -e["amount"]
        by_day[day_offset] = by_day.get(day_offset, 0) + delta

    series = []
    running = 0
    for d in range(horizon_days + 1):
        running += by_day.get(d, 0)
        date = today + timedelta(days=d)
        series.append({
            "day": d,
            "date": date.isoformat(),
            "balance_kobo": int(running),
        })
    return series


def _detect_cash_gaps(
    events: List[Dict],
    today: datetime,
    starting_balance_kobo: int = 0,
) -> List[Dict[str, Any]]:
    """Detect cash gaps in projected balance series.

    A gap opens when the running balance crosses below zero and closes when it
    recovers to >= 0. starting_balance_kobo is the farmer's actual Working pot
    balance at "today" — without this, every farmer is modelled as starting
    broke, which inflates gaps by the value of their existing cash.

    The gap amount reported is the deepest (most negative) point reached during
    the gap, i.e. the peak unmet need — not the cumulative shortfall.
    """
    gaps = []
    running = int(starting_balance_kobo)
    gap_start = None
    deepest = 0  # tracks min running balance during the current gap

    for event in events:
        if event["type"] == "INCOME":
            running += event["amount"]
        else:
            running -= event["amount"]

        if running < 0:
            if gap_start is None:
                gap_start = event["date"]
                deepest = running
            elif running < deepest:
                deepest = running
        elif running >= 0 and gap_start is not None:
            gaps.append({
                "start_date": gap_start,
                "end_date": event["date"],
                "gap_amount_kobo": abs(deepest),
                "status": "PREDICTED",
            })
            gap_start = None
            deepest = 0

    if gap_start is not None:
        gaps.append({
            "start_date": gap_start,
            "end_date": (today + timedelta(days=90)).isoformat(),
            "gap_amount_kobo": abs(deepest),
            "status": "PREDICTED",
        })

    return gaps


def forecast(
    farmer_id: str,
    crop_type: str,
    region: str,
    planting_date: Optional[str],
    expected_harvest_date: Optional[str],
    transaction_history: List[Dict[str, Any]],
    horizon_days: int = 180,
    starting_balance_kobo: int = 0,
) -> Dict[str, Any]:
    model = load_model(crop_type)

    today = datetime.utcnow().replace(tzinfo=None)
    future_dates = pd.date_range(start=today, periods=horizon_days, freq="D")
    future_df = pd.DataFrame({"ds": future_dates})

    # Fine-tune with personal history if available
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
                stan_backend="CMDSTANPY",
            )
            personal_model.fit(personal_df)
            forecast_df = personal_model.predict(future_df)
        else:
            forecast_df = model.predict(future_df)
    else:
        forecast_df = model.predict(future_df)

    # Build events: income clustered at harvest, expenses from crop cycle
    events = []
    events.extend(_generate_income_events(crop_type, today, horizon_days, planting_date, expected_harvest_date, forecast_df))
    events.extend(_generate_expense_events(crop_type, today, horizon_days, planting_date, expected_harvest_date))
    events.sort(key=lambda e: e["date"])

    cash_gaps = _detect_cash_gaps(events, today, starting_balance_kobo=starting_balance_kobo)
    projected_balance = _build_balance_series(events, today, horizon_days)

    return {
        "farmer_id": farmer_id,
        "model_version": MODEL_VERSION,
        "generated_at": today.isoformat(),
        "horizon_days": horizon_days,
        "events": events,
        "cash_gaps": cash_gaps,
        "projected_balance": projected_balance,
    }


def stress_test(
    crop_type: str,
    scenario: str,
    transaction_history: List[Dict[str, Any]],
    horizon_days: int = 180,
    starting_balance_kobo: int = 0,
    region: str = "Nigeria",
    planting_date: Optional[str] = None,
    expected_harvest_date: Optional[str] = None,
) -> Dict[str, Any]:
    base = forecast(
        farmer_id="stress-test",
        crop_type=crop_type,
        region=region,
        planting_date=planting_date,
        expected_harvest_date=expected_harvest_date,
        transaction_history=transaction_history,
        horizon_days=horizon_days,
        starting_balance_kobo=starting_balance_kobo,
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
    base["cash_gaps"] = _detect_cash_gaps(events, datetime.utcnow(), starting_balance_kobo=starting_balance_kobo)
    base["scenario"] = scenario
    return base
