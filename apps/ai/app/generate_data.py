"""Run this once to generate synthetic training data CSVs."""
import os
import csv
from app.simulator import generate_dataset, CROP_PROFILES

os.makedirs("data/synthetic", exist_ok=True)

for crop in CROP_PROFILES.keys():
    events = generate_dataset(crop, n_farmers=100)
    path = f"data/synthetic/{crop.lower()}.csv"
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["farmer_id", "crop_type", "date", "amount_kobo", "type", "category", "description"])
        writer.writeheader()
        for e in events:
            writer.writerow({**e, "date": e["date"].isoformat()})
    print(f"  {crop}: {len(events)} events → {path}")

print("Done.")
