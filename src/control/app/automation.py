"""Account-scoped automation validation and evaluation."""
from __future__ import annotations

import asyncio
import logging
import math
import psycopg
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from psycopg.types.json import Json

from app.database import db
from app.config import settings

logger = logging.getLogger(__name__)
LOCK_OFFSET = 800000000000
telemetry_changed = asyncio.Event()


def key(ref: dict) -> tuple[int, str]:
    return (int(ref["device_id"]), ref["metric"])


def refs(node: dict) -> list[dict]:
    if "children" in node:
        return [ref for child in node["children"] for ref in refs(child)]
    result = [node["left"]]
    if node["right"]["kind"] == "reference":
        result.append(node["right"])
    return result


def actions(definition: dict) -> list[tuple[bool, dict]]:
    return [(branch, action) for branch, name in ((True, "then"), (False, "otherwise")) for action in definition.get(name, [])]


def validate_definition(definition: Any, capabilities: dict[tuple[int, str], dict]) -> dict:
    if not isinstance(definition, dict):
        raise ValueError("Rule definition must be an object")

    def capability(ref: Any) -> dict:
        if not isinstance(ref, dict) or type(ref.get("device_id")) is not int or not isinstance(ref.get("metric"), str):
            raise ValueError("Invalid device or metric reference")
        cap = capabilities.get(key(ref))
        if cap is None:
            raise ValueError("Device or capability not found")
        return cap

    count = 0

    def condition(node: Any, depth: int) -> None:
        nonlocal count
        count += 1
        if count > 60 or depth > 5 or not isinstance(node, dict):
            raise ValueError("Condition is too complex or invalid")
        if "children" in node:
            children = node.get("children")
            if node.get("op") not in ("all", "any") or not isinstance(children, list) or not children:
                raise ValueError("Condition group requires AND/OR and at least one item")
            for child in children:
                condition(child, depth + 1)
            return
        cap = capability(node.get("left"))
        kind = cap["data_type"]
        if node.get("operator") not in (("eq", "ne", "gt", "lt", "gte", "lte") if kind == "number" else ("eq", "ne")):
            raise ValueError("Operator is not valid for the selected type")
        right = node.get("right")
        if not isinstance(right, dict) or right.get("kind") not in ("literal", "reference"):
            raise ValueError("Comparison requires a value or reference")
        if right["kind"] == "reference":
            if capability(right)["data_type"] != kind:
                raise ValueError("Compared capabilities must have the same type")
        else:
            value = right.get("value")
            if (kind == "boolean" and type(value) is not bool or
                kind == "number" and (type(value) not in (float, int) or not math.isfinite(value)) or
                kind == "string" and not isinstance(value, str)):
                raise ValueError("Comparison value has the wrong type")

    condition(definition.get("condition"), 0)
    for branch in ("then", "otherwise"):
        items = definition.get(branch, [])
        if not isinstance(items, list) or len(items) > 32:
            raise ValueError("Invalid actions")
        seen = set()
        for action in items:
            cap = capability(action)
            if cap["role"] != "actuator" or cap["data_type"] != "boolean" or type(action.get("value")) is not bool:
                raise ValueError("Actions require a boolean actuator and value")
            if key(action) in seen:
                raise ValueError("An actuator can appear once in each branch")
            seen.add(key(action))
    if not definition.get("then") and not definition.get("otherwise"):
        raise ValueError("At least one action is required")
    return definition


def ensure_acyclic(definitions: list[dict], capabilities: dict[tuple[int, str], dict]) -> None:
    graph: dict[tuple[int, str], set[tuple[int, str]]] = {}
    for definition in definitions:
        outputs = {key(action) for _, action in actions(definition)}
        for source in refs(definition["condition"]):
            src = key(source)
            if capabilities.get(src, {}).get("role") == "actuator":
                graph.setdefault(src, set()).update(outputs)
    visiting, done = set(), set()

    def visit(node: tuple[int, str]) -> None:
        if node in visiting:
            raise ValueError("Rules create a cycle between actuators")
        if node in done:
            return
        visiting.add(node)
        for child in graph.get(node, ()):
            visit(child)
        visiting.remove(node)
        done.add(node)

    for node in graph:
        visit(node)


async def owner_capabilities(cur, user_id: int) -> dict[tuple[int, str], dict]:
    await cur.execute("""SELECT c.device_id,c.name,c.role,c.data_type,c.unit
                         FROM device_capabilities c JOIN devices d ON d.id=c.device_id
                         WHERE d.user_id=%s AND d.is_active=TRUE""", (user_id,))
    return {(r["device_id"], r["name"]): r for r in await cur.fetchall()}


async def invalidate(cur, user_id: int) -> None:
    await cur.execute("DELETE FROM automation_intents WHERE user_id=%s", (user_id,))
    await cur.execute("""UPDATE device_commands c SET status='superseded'
        WHERE c.status='pending' AND c.device_id IN (SELECT id FROM devices WHERE user_id=%s)
        AND (c.automation_rule_id IS NOT NULL OR
          (EXISTS(SELECT 1 FROM automation_rule_targets t JOIN automation_rules r ON r.id=t.rule_id
                  WHERE r.user_id=%s AND r.enabled AND t.device_id=c.device_id AND t.metric=c.metric)
           AND NOT EXISTS(SELECT 1 FROM automation_modes m WHERE m.user_id=%s AND m.mode='manual'
                AND (m.scope='account' OR (m.scope='device' AND m.device_id=c.device_id)
                  OR (m.scope='actuator' AND m.device_id=c.device_id AND m.metric=c.metric)))))""", (user_id, user_id, user_id))


def compare(left: Any, op: str, right: Any) -> bool:
    return {"eq": lambda: left == right, "ne": lambda: left != right,
            "gt": lambda: left > right, "lt": lambda: left < right,
            "gte": lambda: left >= right, "lte": lambda: left <= right}[op]()


def evaluate(node: dict, readings: dict[tuple[int, str], tuple[Any, datetime]], now: datetime, freshness: int) -> tuple[bool | None, datetime | None]:
    """Unknown inputs suspend a whole rule, even if another OR term is true."""
    if "children" in node:
        values = [evaluate(child, readings, now, freshness) for child in node["children"]]
        if any(v is None for v, _ in values):
            return None, None
        return (all(v for v, _ in values) if node["op"] == "all" else any(v for v, _ in values)), min(t for _, t in values if t is not None)

    def read(ref: dict) -> tuple[Any, datetime | None]:
        item = readings.get(key(ref))
        if not item or item[1] + timedelta(seconds=freshness) <= now:
            return None, None
        return item[0], item[1] + timedelta(seconds=freshness)

    left, left_until = read(node["left"])
    if left_until is None:
        return None, None
    if node["right"]["kind"] == "reference":
        right, right_until = read(node["right"])
        if right_until is None:
            return None, None
        valid_until = min(left_until, right_until)
    else:
        right, valid_until = node["right"]["value"], left_until
    try:
        return compare(left, node["operator"], right), valid_until
    except (TypeError, KeyError):
        return None, None


async def evaluate_owner(user_id: int) -> None:
    now = datetime.now(timezone.utc)
    async with db.transaction() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT pg_try_advisory_xact_lock(%s) AS acquired", (LOCK_OFFSET + user_id,))
            if not (await cur.fetchone())["acquired"]:
                return
            capabilities = await owner_capabilities(cur, user_id)
            await cur.execute("SELECT * FROM automation_rules WHERE user_id=%s AND enabled ORDER BY priority,id", (user_id,))
            rules = await cur.fetchall()
            cycle_error = None
            try:
                ensure_acyclic([rule["definition"] for rule in rules], capabilities)
            except (ValueError, KeyError, TypeError) as exc:
                cycle_error = str(exc)
            await cur.execute("SELECT scope,device_id,metric FROM automation_modes WHERE user_id=%s AND mode='manual'", (user_id,))
            manual = {(r["scope"], r["device_id"], r["metric"]) for r in await cur.fetchall()}
            await cur.execute("SELECT p.device_id,p.last_poll_at FROM automation_device_polls p JOIN devices d ON d.id=p.device_id WHERE d.user_id=%s", (user_id,))
            last_polls = {r["device_id"]: r["last_poll_at"] for r in await cur.fetchall()}
            needed = {key(ref) for rule in rules for ref in refs(rule["definition"]["condition"])}
            readings = {}
            for device_id, metric in needed:
                cap = capabilities.get((device_id, metric))
                if not cap:
                    continue
                table = {"number": "sensor_metrics_numeric", "boolean": "sensor_metrics_boolean", "string": "sensor_metrics_text"}[cap["data_type"]]
                await cur.execute(f"SELECT value,received_at FROM {table} WHERE device_id=%s AND metric_name=%s ORDER BY received_at DESC LIMIT 1", (device_id, metric))
                row = await cur.fetchone()
                if row:
                    readings[(device_id, metric)] = (row["value"], row["received_at"])
            decisions: dict[tuple[int, str], tuple[int, bool, datetime] | None] = {}
            for rule in rules:
                definition = rule["definition"]
                all_targets = {key(a) for _, a in actions(definition)}
                invalid = cycle_error
                if not invalid:
                    try:
                        validate_definition(definition, capabilities)
                    except (ValueError, KeyError, TypeError) as exc:
                        invalid = str(exc)
                if invalid:
                    await cur.execute("UPDATE automation_rules SET state='invalid',error=%s,evaluated_at=%s,candidate=NULL,candidate_since=NULL,stable_value=NULL WHERE id=%s", (invalid, now, rule["id"]))
                    for target in all_targets:
                        decisions.setdefault(target, None)
                    continue
                result, valid_until = evaluate(definition["condition"], readings, now, rule["freshness_seconds"])
                candidate, since, stable = rule["candidate"], rule["candidate_since"], rule["stable_value"]
                if result is None:
                    candidate = since = stable = None
                    status = "waiting_data"
                else:
                    if candidate is None or candidate != result:
                        candidate, since = result, now
                    if (now - since).total_seconds() >= rule["delay_seconds"]:
                        stable = candidate
                    status = "active" if stable is not None else "waiting_delay"
                    if stable is not None:
                        branch_targets = [key(action) for branch, action in actions(definition) if branch == stable]
                        manual_targets = [target for target in branch_targets if ("account", 0, "") in manual or ("device", target[0], "") in manual or ("actuator", target[0], target[1]) in manual]
                        if branch_targets and len(manual_targets) == len(branch_targets):
                            status = "paused_manual"
                        elif manual_targets:
                            status = "partial_manual"
                        for branch, action in actions(definition):
                            device_id, metric = key(action)
                            if branch == stable and ("account", 0, "") not in manual and ("device", device_id, "") not in manual and ("actuator", device_id, metric) not in manual:
                                polled = last_polls.get(device_id)
                                if polled is None or now - polled > timedelta(seconds=15):
                                    status = "waiting_device"
                                    break
                await cur.execute("""UPDATE automation_rules SET candidate=%s,candidate_since=%s,stable_value=%s,
                                     state=%s,evaluated_at=%s,error=NULL WHERE id=%s""", (candidate, since, stable, status, now, rule["id"]))
                if result is None or stable is None:
                    for target in all_targets:
                        decisions.setdefault(target, None)
                    continue
                for branch, action in actions(definition):
                    target = key(action)
                    if branch == stable and target not in decisions:
                        if target not in capabilities or capabilities[target]["role"] != "actuator" or capabilities[target]["data_type"] != "boolean":
                            decisions[target] = None
                        else:
                            decisions[target] = (rule["id"], action["value"], valid_until)
            await cur.execute("SELECT device_id,metric,rule_id,value FROM automation_intents WHERE user_id=%s", (user_id,))
            previous = {(r["device_id"], r["metric"]): (r["rule_id"], r["value"]) for r in await cur.fetchall()}
            active = {}
            for (device_id, metric), decision in decisions.items():
                if not decision or ("account", 0, "") in manual or ("device", device_id, "") in manual or ("actuator", device_id, metric) in manual:
                    continue
                rule_id, value, valid_until = decision
                active[(device_id, metric)] = (rule_id, value)
                await cur.execute("""INSERT INTO automation_intents(device_id,metric,user_id,rule_id,value,valid_until)
                    VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(device_id,metric) DO UPDATE
                    SET rule_id=excluded.rule_id,value=excluded.value,valid_until=excluded.valid_until,updated_at=now()""",
                    (device_id, metric, user_id, rule_id, value, valid_until))
            for target in previous.keys() - active.keys():
                await cur.execute("DELETE FROM automation_intents WHERE device_id=%s AND metric=%s", target)
            for target in previous.keys() | active.keys():
                if previous.get(target) != active.get(target):
                    await cur.execute("SELECT pg_notify('signaldeck_command_wake', %s)", (str(target[0]),))
                    await cur.execute("""UPDATE device_commands SET status='superseded' WHERE device_id=%s AND metric=%s
                                         AND automation_rule_id IS NOT NULL AND status='pending'""", target)
                    entry = active.get(target)
                    await cur.execute("INSERT INTO automation_events(user_id,rule_id,device_id,metric,event,details) VALUES(%s,%s,%s,%s,%s,%s)",
                                      (user_id, entry[0] if entry else None, target[0], target[1], "desired_changed" if entry else "suspended", Json({"value": entry[1]} if entry else {})))


async def automation_worker() -> None:
    # Reset condition timers after a server restart; stale observations must not count as continuous.
    try:
        await db.execute("UPDATE automation_rules SET candidate=NULL,candidate_since=NULL,stable_value=NULL,state='waiting'")
        await db.execute("DELETE FROM automation_intents")
    except Exception:
        logger.exception("Failed to initialize automation state")
    while True:
        telemetry_changed.clear()
        try:
            owners = await db.fetch_all("SELECT DISTINCT user_id FROM automation_rules WHERE enabled")
            for owner in owners:
                try:
                    await evaluate_owner(owner["user_id"])
                except Exception:
                    logger.exception("Automation evaluation failed for user %s", owner["user_id"])
        except Exception:
            logger.exception("Automation worker failed")
        try:
            await asyncio.wait_for(telemetry_changed.wait(), timeout=1)
        except asyncio.TimeoutError:
            pass


async def listen_for_telemetry() -> None:
    while True:
        try:
            async with await psycopg.AsyncConnection.connect(settings.DATABASE_URL, autocommit=True) as conn:
                await conn.execute("LISTEN signaldeck_telemetry")
                async for _ in conn.notifies():
                    telemetry_changed.set()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Telemetry listener disconnected")
            await asyncio.sleep(2)
