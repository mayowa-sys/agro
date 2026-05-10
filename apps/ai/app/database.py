import asyncpg
import os
import logging

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None

async def get_db_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agro:agro@localhost:5432/agro")
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
        logger.info("Database pool created for AI service")
    return _pool
