import logging
from contextlib import asynccontextmanager
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from app.config import settings

logger = logging.getLogger(__name__)


class Database:
    def __init__(self) -> None:
        self.pool: AsyncConnectionPool | None = None

    async def connect(self) -> None:
        self.pool = AsyncConnectionPool(
            settings.DATABASE_URL,
            min_size=2,
            max_size=20,
            open=False,
            kwargs={"row_factory": dict_row},
        )
        await self.pool.open()
        await self._migrate_users_profile()
        logger.info("Database pool opened")

    async def _migrate_users_profile(self) -> None:
        migrations = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS organization VARCHAR(200)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(120)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(64)",
        ]
        for query in migrations:
            await self.execute(query)
        logger.info("Users profile columns migrated")

    async def disconnect(self) -> None:
        if self.pool:
            await self.pool.close()
            logger.info("Database pool closed")

    async def fetch_one(self, query: str, *args: Any) -> dict[str, Any] | None:
        async with self.pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, args)
                return await cur.fetchone()

    async def fetch_all(self, query: str, *args: Any) -> list[dict[str, Any]]:
        async with self.pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, args)
                return await cur.fetchall()

    async def execute(self, query: str, *args: Any) -> int:
        async with self.pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, args)
                return cur.rowcount

    async def fetch_val(self, query: str, *args: Any) -> Any:
        async with self.pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, args)
                row = await cur.fetchone()
                if row is None:
                    return None
                return next(iter(row.values()))

    async def executemany(self, query: str, params_list: list[tuple[Any, ...]]) -> int:
        if not params_list:
            return 0
        async with self.pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.executemany(query, params_list)
                return cur.rowcount

    @asynccontextmanager
    async def transaction(self):
        async with self.pool.connection() as conn:
            async with conn.transaction():
                yield conn


db = Database()
