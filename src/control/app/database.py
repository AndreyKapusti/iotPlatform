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
        await self._migrate_automation()
        logger.info("Database pool opened")

    async def _migrate_automation(self) -> None:
        await self.execute("""
            CREATE TABLE IF NOT EXISTS automation_rules (
                id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, priority BIGINT NOT NULL,
                definition JSONB NOT NULL, freshness_seconds INTEGER NOT NULL DEFAULT 30,
                delay_seconds INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), state TEXT NOT NULL DEFAULT 'waiting',
                candidate BOOLEAN, candidate_since TIMESTAMPTZ, stable_value BOOLEAN,
                evaluated_at TIMESTAMPTZ, error TEXT
            );
            CREATE INDEX IF NOT EXISTS automation_rules_owner_idx ON automation_rules(user_id, priority, id);
            CREATE TABLE IF NOT EXISTS automation_rule_targets (
                rule_id BIGINT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
                device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
                metric TEXT NOT NULL, branch BOOLEAN NOT NULL, value BOOLEAN NOT NULL,
                PRIMARY KEY(rule_id, device_id, metric, branch)
            );
            CREATE INDEX IF NOT EXISTS automation_targets_device_idx ON automation_rule_targets(device_id,metric);
            CREATE TABLE IF NOT EXISTS automation_modes (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                scope TEXT NOT NULL CHECK(scope IN ('account','device','actuator')),
                device_id INTEGER NOT NULL DEFAULT 0, metric TEXT NOT NULL DEFAULT '',
                mode TEXT NOT NULL CHECK(mode IN ('auto','manual')),
                PRIMARY KEY(user_id, scope, device_id, metric)
            );
            CREATE TABLE IF NOT EXISTS automation_intents (
                device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE, metric TEXT NOT NULL,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                rule_id BIGINT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
                value BOOLEAN NOT NULL, valid_until TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY(device_id,metric)
            );
            CREATE TABLE IF NOT EXISTS automation_events (
                id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                rule_id BIGINT REFERENCES automation_rules(id) ON DELETE SET NULL,
                device_id INTEGER, metric TEXT, event TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS automation_device_polls (
                device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
                last_poll_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS shared_dashboards (
                id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL, layout_json JSONB NOT NULL DEFAULT '[]',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE(user_id,name)
            );
        """)

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
