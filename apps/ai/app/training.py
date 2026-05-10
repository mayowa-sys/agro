"""
Training pipeline — fits a Prophet model per crop type on synthetic data.
Run: python -m app.training
Models saved to models/prophet_<crop>.pkl
"""
import os
import pickle
import csv
from datetime import datetime
from collections import defaultdict

import pandas as pd
from prophet import Prophet

DATA_DIR = "data/synthetic"
MODEL_DIR = "models"

def load_crop_data(crop: str) -> pd.DataFrame:
    path = os.path.join(DATA_DIR, f"{crop.lower()}.csv")
    rows = []
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["type"] == "INCOME":
                rows.append({
                    "ds": datetime.fromisoformat(row["date"]).replace(tzinfo=None),
                    "y": float(row["amount_kobo"]) / 100,  # kobo → naira
                })
    df = pd.DataFrame(rows)
    # Aggregate to weekly to smooth noise
    df["ds"] = pd.to_datetime(df["ds"]).dt.to_period("W").apply(lambda r: r.start_time)
    df = df.groupby("ds")["y"].sum().reset_index()
    return df


def train_crop_model(crop: str) -> Prophet:
    df = load_crop_data(crop)
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode="multiplicative",
        interval_width=0.80,
        stan_backend="CMDSTANPY",
    )
    model.fit(df)
    return model


def main():
    os.makedirs(MODEL_DIR, exist_ok=True)
    crops = ["YAM", "CASSAVA", "TOMATO", "MAIZE", "RICE", "COCOA"]
    for crop in crops:
        print(f"Training {crop}...")
        model = train_crop_model(crop)
        path = os.path.join(MODEL_DIR, f"prophet_{crop.lower()}.pkl")
        with open(path, "wb") as f:
            pickle.dump(model, f)
        print(f"  Saved → {path}")
    print("All models trained.")


if __name__ == "__main__":
    main()
