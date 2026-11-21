from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from psycopg.types.json import Json

from app.automation import LOCK_OFFSET, actions, ensure_acyclic, invalidate, owner_capabilities, validate_definition
from app.database import db
from app.deps import get_current_user

router = APIRouter()


class RuleInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    enabled: bool = True
    freshness_seconds: int = Field(default=30, ge=1, le=86400)
    delay_seconds: int = Field(default=0, ge=0, le=86400)
    definition: dict[str, Any]

    @field_validator("name")
    @classmethod
    def nonempty_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value


class ModeInput(BaseModel):
    scope: Literal["account", "device", "actuator"]
    device_id: int = 0
    metric: str = ""
    mode: Literal["auto", "manual"]


class ReorderInput(BaseModel):
    ids: list[int]


async def lock(cur, user_id: int) -> None:
    await cur.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_OFFSET + user_id,))


async def validate_rule(cur, user_id: int, body: RuleInput, exclude_id: int | None) -> None:
    caps = await owner_capabilities(cur, user_id)
    try:
        validate_definition(body.definition, caps)
        await cur.execute("SELECT definition FROM automation_rules WHERE user_id=%s AND enabled AND (%s::bigint IS NULL OR id<>%s)", (user_id, exclude_id, exclude_id))
        definitions = [r["definition"] for r in await cur.fetchall()]
        if body.enabled:
            definitions.append(body.definition)
        ensure_acyclic(definitions, caps)
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(400, str(exc)) from exc


async def save_targets(cur, rule_id: int, definition: dict) -> None:
    await cur.execute("DELETE FROM automation_rule_targets WHERE rule_id=%s", (rule_id,))
    for branch, action in actions(definition):
        await cur.execute("INSERT INTO automation_rule_targets(rule_id,device_id,metric,branch,value) VALUES(%s,%s,%s,%s,%s)",
                          (rule_id, action["device_id"], action["metric"], branch, action["value"]))


@router.get("/capabilities")
async def capabilities(user: dict = Depends(get_current_user)) -> list[dict]:
    return await db.fetch_all("""SELECT d.id AS device_id,d.name AS device_name,d.last_seen_at,
        c.name,c.role,c.data_type AS type,c.unit,c.min_value AS min,c.max_value AS max
        FROM devices d JOIN device_capabilities c ON c.device_id=d.id
        WHERE d.user_id=%s AND d.is_active=TRUE ORDER BY d.name,c.name""", user["id"])


@router.get("/rules")
async def list_rules(user: dict = Depends(get_current_user)) -> list[dict]:
    return await db.fetch_all("SELECT * FROM automation_rules WHERE user_id=%s ORDER BY priority,id", user["id"])


@router.post("/rules", status_code=201)
async def create_rule(body: RuleInput, user: dict = Depends(get_current_user)) -> dict:
    async with db.transaction() as conn:
        async with conn.cursor() as cur:
            await lock(cur, user["id"])
            await validate_rule(cur, user["id"], body, None)
            await cur.execute("""INSERT INTO automation_rules(user_id,name,enabled,priority,definition,freshness_seconds,delay_seconds)
                VALUES(%s,%s,%s,(SELECT COALESCE(MAX(priority),0)+1 FROM automation_rules WHERE user_id=%s),%s,%s,%s) RETURNING *""",
                (user["id"], body.name.strip(), body.enabled, user["id"], Json(body.definition), body.freshness_seconds, body.delay_seconds))
            row = await cur.fetchone()
            await save_targets(cur, row["id"], body.definition)
            await invalidate(cur, user["id"])
            return row


@router.put("/rules/order")
async def reorder_rules(body: ReorderInput, user: dict = Depends(get_current_user)) -> dict:
    async with db.transaction() as conn:
        async with conn.cursor() as cur:
            await lock(cur, user["id"])
            await cur.execute("SELECT id FROM automation_rules WHERE user_id=%s", (user["id"],))
            actual = {r["id"] for r in await cur.fetchall()}
            if len(body.ids) != len(actual) or set(body.ids) != actual:
                raise HTTPException(400, "Order must contain every rule exactly once")
            for index, rule_id in enumerate(body.ids):
                await cur.execute("UPDATE automation_rules SET priority=%s WHERE id=%s AND user_id=%s", (index, rule_id, user["id"]))
            await invalidate(cur, user["id"])
    return {"ok": True}


@router.put("/rules/{rule_id}")
async def update_rule(rule_id: int, body: RuleInput, user: dict = Depends(get_current_user)) -> dict:
    async with db.transaction() as conn:
        async with conn.cursor() as cur:
            await lock(cur, user["id"])
            await cur.execute("SELECT id FROM automation_rules WHERE id=%s AND user_id=%s", (rule_id, user["id"]))
            if not await cur.fetchone():
                raise HTTPException(404, "Rule not found")
            await validate_rule(cur, user["id"], body, rule_id)
            await cur.execute("""UPDATE automation_rules SET name=%s,enabled=%s,definition=%s,freshness_seconds=%s,
                delay_seconds=%s,candidate=NULL,candidate_since=NULL,stable_value=NULL,state='waiting',updated_at=now()
                WHERE id=%s AND user_id=%s RETURNING *""",
                (body.name.strip(), body.enabled, Json(body.definition), body.freshness_seconds, body.delay_seconds, rule_id, user["id"]))
            row = await cur.fetchone()
            await save_targets(cur, rule_id, body.definition)
            await invalidate(cur, user["id"])
            return row


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: int, user: dict = Depends(get_current_user)) -> dict:
    async with db.transaction() as conn:
        async with conn.cursor() as cur:
            await lock(cur, user["id"])
            await invalidate(cur, user["id"])
            await cur.execute("DELETE FROM automation_rules WHERE id=%s AND user_id=%s RETURNING id", (rule_id, user["id"]))
            if not await cur.fetchone():
                raise HTTPException(404, "Rule not found")
    return {"ok": True}


@router.get("/modes")
async def get_modes(user: dict = Depends(get_current_user)) -> dict:
    modes = await db.fetch_all("SELECT scope,device_id,metric,mode FROM automation_modes WHERE user_id=%s", user["id"])
    targets = await db.fetch_all("""SELECT DISTINCT t.device_id,t.metric FROM automation_rule_targets t
        JOIN automation_rules r ON r.id=t.rule_id WHERE r.user_id=%s AND r.enabled""", user["id"])
    return {"modes": modes, "automatic_targets": targets}


@router.put("/modes")
async def set_mode(body: ModeInput, user: dict = Depends(get_current_user)) -> dict:
    if body.scope == "account" and (body.device_id != 0 or body.metric):
        raise HTTPException(400, "Invalid account mode")
    if body.scope == "device" and (body.device_id <= 0 or body.metric):
        raise HTTPException(400, "Invalid device mode")
    if body.scope == "actuator" and (body.device_id <= 0 or not body.metric):
        raise HTTPException(400, "Invalid actuator mode")
    async with db.transaction() as conn:
        async with conn.cursor() as cur:
            await lock(cur, user["id"])
            if body.scope != "account":
                await cur.execute("SELECT id FROM devices WHERE id=%s AND user_id=%s", (body.device_id, user["id"]))
                if not await cur.fetchone():
                    raise HTTPException(404, "Device not found")
            if body.scope == "actuator":
                caps = await owner_capabilities(cur, user["id"])
                cap = caps.get((body.device_id, body.metric))
                if not cap or cap["role"] != "actuator" or cap["data_type"] != "boolean":
                    raise HTTPException(400, "Unknown boolean actuator")
            await cur.execute("""INSERT INTO automation_modes(user_id,scope,device_id,metric,mode) VALUES(%s,%s,%s,%s,%s)
                ON CONFLICT(user_id,scope,device_id,metric) DO UPDATE SET mode=excluded.mode""",
                (user["id"], body.scope, body.device_id, body.metric, body.mode))
            await invalidate(cur, user["id"])
    return {"ok": True}


@router.get("/events")
async def events(user: dict = Depends(get_current_user)) -> list[dict]:
    return await db.fetch_all("""SELECT * FROM (
        SELECT e.id,e.rule_id,e.device_id,e.metric,e.event,e.details,e.created_at
        FROM automation_events e WHERE e.user_id=%s
        UNION ALL
        SELECT -c.id,c.automation_rule_id,c.device_id,c.metric,'command',
               jsonb_build_object('command_id',c.id,'value',c.value,'status',
                 CASE WHEN c.status='pending' AND c.expires_at<=now() THEN 'expired' ELSE c.status END),c.created_at
        FROM device_commands c JOIN devices d ON d.id=c.device_id
        WHERE d.user_id=%s AND c.automation_rule_id IS NOT NULL
        ) e ORDER BY created_at DESC LIMIT 100""", user["id"], user["id"])
