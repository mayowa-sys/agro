from sentence_transformers import SentenceTransformer
import numpy as np
import json
import logging

logger = logging.getLogger(__name__)

_model: SentenceTransformer | None = None

def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("Loading sentence transformer model all-MiniLM-L6-v2...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Model loaded.")
    return _model

def embed_text(text: str) -> list[float]:
    """Embed a single string. Returns a 384-dim float list."""
    model = get_model()
    vec = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return vec.tolist()

def embed_labourer_profile(labourer: dict) -> str:
    """Build a descriptive text from labourer fields and embed it."""
    skills_text = ", ".join(labourer.get("skills", []))
    languages_text = " and ".join(labourer.get("spokenLanguages", ["English"]))
    region = labourer.get("region", "")

    text = (
        f"Agricultural worker skilled in {skills_text}. "
        f"Based in {region}. "
        f"Languages: {languages_text}. "
        f"Farm labour, crop work, field operations."
    )

    vec = embed_text(text)
    return json.dumps(vec)

def embed_job_description(job: dict) -> str:
    """Build a descriptive text from job fields and embed it."""
    skills_text = ", ".join(job.get("skillsRequired", []))
    title = job.get("title", "")
    description = job.get("description", "") or ""
    region = job.get("region", "")
    duration = job.get("durationDays", 1)

    text = (
        f"Farm job: {title}. "
        f"{description} "
        f"Requires skills: {skills_text}. "
        f"Location: {region}. "
        f"Duration: {duration} days."
    )

    vec = embed_text(text)
    return json.dumps(vec)

def cosine_similarity(vec_a_json: str, vec_b_json: str) -> float:
    """Compute cosine similarity between two stored embedding JSON strings."""
    a = np.array(json.loads(vec_a_json), dtype=np.float32)
    b = np.array(json.loads(vec_b_json), dtype=np.float32)
    return float(np.dot(a, b))
