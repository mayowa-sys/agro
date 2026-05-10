from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from dotenv import load_dotenv
from app.forecaster import forecast, stress_test

load_dotenv()

app = FastAPI(title="AGRO AI Service")
bearer = HTTPBearer()
MODEL_VERSION = "v1.0.0"

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    token = os.getenv("AI_SERVICE_TOKEN", "")
    if credentials.credentials != token:
        raise HTTPException(status_code=401, detail="Invalid token")
    return credentials.credentials

@app.get("/health")
def health():
    return {"status": "ok", "model_version": MODEL_VERSION}


class TransactionItem(BaseModel):
    date: str
    amount: float
    type: str

class ForecastRequest(BaseModel):
    farmer_id: str
    crop_type: str
    region: str
    planting_date: Optional[str] = None
    expected_harvest_date: Optional[str] = None
    transaction_history: List[TransactionItem] = []
    horizon_days: int = 90

class StressTestRequest(BaseModel):
    crop_type: str
    scenario: str
    transaction_history: List[TransactionItem] = []

class SplitSuggestRequest(BaseModel):
    farmer_id: str
    forecast: Optional[Dict[str, Any]] = None
    current_split: Optional[Dict[str, Any]] = None


@app.post("/forecast", dependencies=[Depends(verify_token)])
def forecast_endpoint(req: ForecastRequest):
    try:
        result = forecast(
            farmer_id=req.farmer_id,
            crop_type=req.crop_type,
            region=req.region,
            planting_date=req.planting_date,
            expected_harvest_date=req.expected_harvest_date,
            transaction_history=[t.model_dump() for t in req.transaction_history],
            horizon_days=req.horizon_days,
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forecast/stress-test", dependencies=[Depends(verify_token)])
def stress_test_endpoint(req: StressTestRequest):
    valid_scenarios = {"drought", "price_crash", "late_buyer", "late_harvest_3wk"}
    if req.scenario not in valid_scenarios:
        raise HTTPException(status_code=400, detail=f"scenario must be one of {valid_scenarios}")
    try:
        result = stress_test(
            crop_type=req.crop_type,
            scenario=req.scenario,
            transaction_history=[t.model_dump() for t in req.transaction_history],
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/split/suggest", dependencies=[Depends(verify_token)])
def split_suggest_endpoint(req: SplitSuggestRequest):
    """
    Grid search in 5% increments to find split minimising cash-gap days.
    """
    events = []
    if req.forecast and "events" in req.forecast:
        events = req.forecast["events"]

    best = {"workingPct": 60, "billsPct": 25, "nextSeasonPct": 15}
    best_gap_days = float("inf")

    for working in range(40, 80, 5):
        for bills in range(10, 50, 5):
            next_season = 100 - working - bills
            if next_season < 5 or next_season > 40:
                continue

            # Simulate split applied to income events
            gap_days = 0
            running = 0
            for e in events:
                if e["type"] == "INCOME":
                    running += e["amount"] * working / 100
                else:
                    running -= e["amount"]
                if running < 0:
                    gap_days += 1

            if gap_days < best_gap_days:
                best_gap_days = gap_days
                best = {"workingPct": working, "billsPct": bills, "nextSeasonPct": next_season}

    return {**best, "expectedGapDays": best_gap_days}

from app.embeddings import embed_labourer_profile, embed_job_description
from app.match import jobs_for_labourer, labourers_for_job
from app.demand import compute_demand_signals

@app.post("/embeddings/labourer", dependencies=[Depends(verify_token)])
async def embed_labourer(body: dict):
    """Compute and return embedding for a labourer profile."""
    embedding_json = embed_labourer_profile(body)
    return {"embedding": embedding_json}

@app.post("/embeddings/job", dependencies=[Depends(verify_token)])
async def embed_job(body: dict):
    """Compute and return embedding for a job description."""
    embedding_json = embed_job_description(body)
    return {"embedding": embedding_json}

@app.get("/match/jobs-for-labourer/{labourer_id}", dependencies=[Depends(verify_token)])
async def get_jobs_for_labourer(labourer_id: str, limit: int = 20):
    results = await jobs_for_labourer(labourer_id, limit=limit)
    return {"matches": results, "count": len(results)}

@app.get("/match/labourers-for-job/{job_id}", dependencies=[Depends(verify_token)])
async def get_labourers_for_job(job_id: str, limit: int = 20):
    results = await labourers_for_job(job_id, limit=limit)
    return {"matches": results, "count": len(results)}

@app.get("/demand-signals/{farmer_id}", dependencies=[Depends(verify_token)])
async def get_demand_signals(farmer_id: str):
    signals = await compute_demand_signals(farmer_id)
    return signals
