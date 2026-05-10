import numpy as np
import logging
from .database import get_db_pool

logger = logging.getLogger(__name__)

async def compute_demand_signals(farmer_id: str) -> dict:
    """Derive demandConfidence and demandConsistency from forecast data."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        events = await conn.fetch(
            """SELECT fe."expectedAmount", fe.confidence, fe."expectedDate"
               FROM "ForecastEvent" fe
               JOIN "Forecast" f ON fe."forecastId" = f.id
               WHERE f."farmerId" = $1
                 AND fe.category = 'LABOUR'
               ORDER BY fe."expectedDate" ASC
               LIMIT 20""",
            farmer_id,
        )

    if not events:
        return {"confidence": 0.5, "consistency": 0.5, "eventCount": 0}

    confidences = []
    amounts = []

    for e in events:
        confidences.append(float(e["confidence"]))
        amt = float(e["expectedAmount"])
        if amt > 0:
            amounts.append(amt)

    # Use the stored Prophet confidence directly
    confidence = float(np.clip(np.mean(confidences) if confidences else 0.5, 0.0, 1.0))

    if len(amounts) < 2:
        consistency = 0.5
    else:
        cv = np.std(amounts) / np.mean(amounts) if np.mean(amounts) > 0 else 1.0
        consistency = float(np.clip(1.0 - cv, 0.0, 1.0))

    return {
        "confidence": round(confidence, 4),
        "consistency": round(consistency, 4),
        "eventCount": len(events),
    }
