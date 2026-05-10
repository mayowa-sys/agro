import math
import logging
from .embeddings import cosine_similarity
from .database import get_db_pool

logger = logging.getLogger(__name__)

def distance_score(distance_km: float, cap_km: float = 50.0) -> float:
    if distance_km >= cap_km:
        return 0.0
    return 1.0 - (distance_km / cap_km)

def reputation_score(tier: int) -> float:
    return (tier - 1) / 4.0

def language_overlap_score(labourer_langs: list[str], farmer_lang: str) -> float:
    if farmer_lang in labourer_langs:
        return 1.0
    if "EN" in labourer_langs or "PIDGIN" in labourer_langs:
        return 0.5
    return 0.0

async def jobs_for_labourer(labourer_id: str, limit: int = 20) -> list[dict]:
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        labourer = await conn.fetchrow(
            """SELECT l.*, u.language as user_lang,
                      l."profileEmbedding", l.latitude, l.longitude,
                      l."spokenLanguages", l."reputationTier"
               FROM "Labourer" l
               JOIN "User" u ON l."userId" = u.id
               WHERE l.id = $1""",
            labourer_id,
        )

        if not labourer or not labourer["profileEmbedding"]:
            return []

        lab_lat = labourer["latitude"]
        lab_lng = labourer["longitude"]
        lab_embedding = labourer["profileEmbedding"]
        lab_langs = labourer["spokenLanguages"]
        lab_tier = labourer["reputationTier"]

        jobs = await conn.fetch(
            """SELECT j.*, u.language as farmer_primary_lang,
                      j."descriptionEmbedding", j."demandConfidence", j."demandConsistency",
                      f.region as farmer_region
               FROM "Job" j
               JOIN "Farmer" f ON j."farmerId" = f.id
               JOIN "User" u ON f."userId" = u.id
               WHERE j.status = 'OPEN'
                 AND j."descriptionEmbedding" IS NOT NULL"""
        )

    results = []

    for job in jobs:
        sem = cosine_similarity(lab_embedding, job["descriptionEmbedding"])
        if sem < 0.15:
            continue

        # Distance: use lat/lng if available, else neutral score
        if lab_lat is not None and lab_lng is not None:
            dist_s = 0.5  # neutral — no farmer coordinates to compare
        else:
            dist_s = 0.5

        demand_conf = float(job["demandConfidence"] or 0.5)
        demand_cons = float(job["demandConsistency"] or 0.5)
        demand_s = (demand_conf + demand_cons) / 2.0
        rep_s = reputation_score(lab_tier)
        lang_s = language_overlap_score(lab_langs, job["farmer_primary_lang"])

        score = (
            0.45 * sem
            + 0.20 * demand_s
            + 0.10 * dist_s
            + 0.15 * rep_s
            + 0.10 * lang_s
        )

        results.append({
            "jobId": job["id"],
            "matchScore": round(score, 4),
            "scoreBreakdown": {
                "semantic": round(sem, 4),
                "demandConfidence": round(demand_s, 4),
                "distance": round(dist_s, 4),
                "reputation": round(rep_s, 4),
                "languageOverlap": round(lang_s, 4),
            },
            "distanceKm": None,
            "demandConfidence": round(demand_conf, 3),
            "demandConsistency": round(demand_cons, 3),
            "title": job["title"],
            "description": job["description"],
            "payAmountKobo": str(job["payAmountKobo"]),
            "expectedDate": job["expectedDate"].isoformat(),
            "durationDays": job["durationDays"],
            "skillsRequired": job["skillsRequired"],
            "farmerId": job["farmerId"],
        })

    results.sort(key=lambda x: x["matchScore"], reverse=True)
    return results[:limit]


async def labourers_for_job(job_id: str, limit: int = 20) -> list[dict]:
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        job = await conn.fetchrow(
            """SELECT j.*, u.language as farmer_primary_lang,
                      j."descriptionEmbedding", j."demandConfidence", j."demandConsistency"
               FROM "Job" j
               JOIN "Farmer" f ON j."farmerId" = f.id
               JOIN "User" u ON f."userId" = u.id
               WHERE j.id = $1""",
            job_id,
        )

        if not job or not job["descriptionEmbedding"]:
            return []

        conflicting_ids = await conn.fetch(
            """SELECT DISTINCT g."labourerId"
               FROM "Gig" g
               JOIN "Job" j2 ON g."jobId" = j2.id
               WHERE g.status IN ('ACCEPTED', 'FARMER_CONFIRMED_DONE', 'LABOURER_CONFIRMED_DONE')
                 AND j2."expectedDate"::date = $1::date""",
            job["expectedDate"],
        )
        excluded = {row["labourerId"] for row in conflicting_ids}

        labourers = await conn.fetch(
            """SELECT l.*, u.language as user_lang,
                      l."profileEmbedding", l."spokenLanguages", l."reputationTier"
               FROM "Labourer" l
               JOIN "User" u ON l."userId" = u.id
               WHERE l."profileEmbedding" IS NOT NULL"""
        )

    results = []

    for lab in labourers:
        if lab["id"] in excluded:
            continue

        sem = cosine_similarity(job["descriptionEmbedding"], lab["profileEmbedding"])
        if sem < 0.15:
            continue

        demand_s = ((job["demandConfidence"] or 0.5) + (job["demandConsistency"] or 0.5)) / 2.0
        rep_s = reputation_score(lab["reputationTier"])
        lang_s = language_overlap_score(lab["spokenLanguages"], job["farmer_primary_lang"])

        score = (
            0.45 * sem
            + 0.20 * demand_s
            + 0.10 * 0.5  # neutral distance
            + 0.15 * rep_s
            + 0.10 * lang_s
        )

        results.append({
            "labourerId": lab["id"],
            "matchScore": round(score, 4),
            "scoreBreakdown": {
                "semantic": round(sem, 4),
                "demandConfidence": round(demand_s, 4),
                "distance": 0.5,
                "reputation": round(rep_s, 4),
                "languageOverlap": round(lang_s, 4),
            },
            "distanceKm": None,
            "fullName": lab["fullName"],
            "region": lab["region"],
            "skills": lab["skills"],
            "reputationTier": lab["reputationTier"],
            "totalGigsCompleted": lab["totalGigsCompleted"],
        })

    results.sort(key=lambda x: x["matchScore"], reverse=True)
    return results[:limit]
