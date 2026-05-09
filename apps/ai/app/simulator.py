import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
import math

CROP_PROFILES = {
    "YAM": {
        "harvest_month": 9,
        "harvest_amount": (180_000_00, 230_000_00),  # kobo
        "mid_inflows": [(4, 20_000_00, 40_000_00)],
        "planting_cost_month": 0,
        "planting_cost": (40_000_00, 60_000_00),
        "weekly_expense": (5_000_00, 15_000_00),
    },
    "CASSAVA": {
        "harvest_month": -1,  # two harvests
        "harvests": [(5, 80_000_00, 120_000_00), (10, 80_000_00, 120_000_00)],
        "planting_cost_month": 0,
        "planting_cost": (25_000_00, 40_000_00),
        "weekly_expense": (4_000_00, 10_000_00),
    },
    "TOMATO": {
        "harvest_month": -1,  # multiple
        "harvests": [(2, 40_000_00, 80_000_00), (4, 40_000_00, 80_000_00),
                     (6, 40_000_00, 80_000_00), (8, 40_000_00, 80_000_00)],
        "planting_cost_month": 0,
        "planting_cost": (20_000_00, 35_000_00),
        "weekly_expense": (6_000_00, 14_000_00),
        "price_crash_chance": 0.2,
    },
    "MAIZE": {
        "harvest_month": 4,
        "harvest_amount": (100_000_00, 150_000_00),
        "planting_cost_month": 0,
        "planting_cost": (30_000_00, 50_000_00),
        "weekly_expense": (4_000_00, 12_000_00),
    },
    "RICE": {
        "harvest_month": 7,
        "harvest_amount": (130_000_00, 180_000_00),
        "planting_cost_month": 0,
        "planting_cost": (35_000_00, 55_000_00),
        "weekly_expense": (5_000_00, 13_000_00),
    },
    "COCOA": {
        "harvest_month": -1,
        "harvests": [(4, 200_000_00, 250_000_00), (10, 200_000_00, 250_000_00)],
        "planting_cost_month": 0,
        "planting_cost": (50_000_00, 80_000_00),
        "weekly_expense": (8_000_00, 18_000_00),
    },
}

def generate_farmer_year(
    crop_type: str,
    region: str,
    planting_date: datetime,
    seed: int = None,
) -> List[Dict[str, Any]]:
    """
    Generate a synthetic year of transactions for a farmer.
    Returns list of { date, amount_kobo, type, category, description }.
    """
    if seed is not None:
        random.seed(seed)

    profile = CROP_PROFILES.get(crop_type.upper())
    if not profile:
        raise ValueError(f"Unknown crop type: {crop_type}")

    events = []

    # Planting cost (month 0-1)
    planting_cost = random.randint(*profile["planting_cost"])
    events.append({
        "date": planting_date + timedelta(days=random.randint(7, 21)),
        "amount_kobo": planting_cost,
        "type": "EXPENSE",
        "category": "INPUT_COST",
        "description": f"Planting inputs: {crop_type.lower()} seeds and fertilizer",
    })

    # Weekly household expenses with random walk noise
    expense_base = random.randint(*profile["weekly_expense"])
    for week in range(52):
        noise = random.randint(-1_000_00, 1_000_00)
        expense = max(2_000_00, expense_base + noise)
        events.append({
            "date": planting_date + timedelta(weeks=week, days=random.randint(0, 6)),
            "amount_kobo": expense,
            "type": "EXPENSE",
            "category": "HOUSEHOLD",
            "description": "Weekly household expenses",
        })

    # Harvest inflows
    if profile.get("harvest_month", -1) != -1:
        # Single harvest
        harvest_date = planting_date + timedelta(days=profile["harvest_month"] * 30 + random.randint(-14, 14))
        harvest_amount = random.randint(*profile["harvest_amount"])
        events.append({
            "date": harvest_date,
            "amount_kobo": harvest_amount,
            "type": "INCOME",
            "category": "HARVEST_PAYMENT",
            "description": f"{crop_type.capitalize()} harvest payment",
        })
    else:
        # Multiple harvests
        for (month, low, high) in profile.get("harvests", []):
            harvest_date = planting_date + timedelta(days=month * 30 + random.randint(-10, 10))
            amount = random.randint(low, high)
            # Price crash chance for tomato
            if profile.get("price_crash_chance") and random.random() < profile["price_crash_chance"]:
                amount = int(amount * 0.5)
            events.append({
                "date": harvest_date,
                "amount_kobo": amount,
                "type": "INCOME",
                "category": "HARVEST_PAYMENT",
                "description": f"{crop_type.capitalize()} harvest payment (batch)",
            })

    # Mid-season small inflows (odd jobs, partial sales)
    for (month, low, high) in profile.get("mid_inflows", []):
        date = planting_date + timedelta(days=month * 30 + random.randint(-7, 7))
        amount = random.randint(low, high)
        events.append({
            "date": date,
            "amount_kobo": amount,
            "type": "INCOME",
            "category": "MISC_INCOME",
            "description": "Partial sale / odd job income",
        })

    events.sort(key=lambda e: e["date"])
    return events


def generate_dataset(crop_type: str, n_farmers: int = 100) -> List[Dict[str, Any]]:
    """Generate n_farmers synthetic farmer-years for a given crop."""
    all_events = []
    base_date = datetime(2023, 3, 1)
    for i in range(n_farmers):
        planting_date = base_date + timedelta(days=random.randint(-30, 30))
        events = generate_farmer_year(crop_type, "Nigeria", planting_date, seed=i)
        for e in events:
            e["farmer_id"] = f"synthetic_{crop_type.lower()}_{i}"
            e["crop_type"] = crop_type
        all_events.extend(events)
    return all_events
