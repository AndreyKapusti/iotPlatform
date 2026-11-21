from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from psycopg.errors import UniqueViolation
from psycopg.types.json import Json

from app.database import db
from app.deps import get_current_user

router = APIRouter()


class SharedWidget(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    device_id: int = Field(gt=0)
    metric: str = Field(min_length=1, max_length=100)
    type: Literal["line", "gauge", "indicator", "toggle"]
    title: str = Field(default="", max_length=120)


class DashboardInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    layout: list[SharedWidget] = Field(default_factory=list, max_length=100)

    @field_validator("name")
    @classmethod
    def nonempty_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value


async def validate_widgets(user_id: int, widgets: list[SharedWidget]) -> None:
    seen = set()
    for widget in widgets:
        if widget.id in seen:
            raise HTTPException(400, "Duplicate widget id")
        seen.add(widget.id)
        row = await db.fetch_one("""SELECT c.data_type,c.role FROM device_capabilities c JOIN devices d ON d.id=c.device_id
            WHERE d.user_id=%s AND d.id=%s AND d.is_active AND c.name=%s""", user_id, widget.device_id, widget.metric)
        allowed = {"line": ("number", "sensor"), "gauge": ("number", "sensor"),
                   "indicator": ("boolean", "sensor"), "toggle": ("boolean", "actuator")}
        if not row or (row["data_type"], row["role"]) != allowed[widget.type]:
            raise HTTPException(400, "Widget device or capability is unavailable")


@router.get("")
async def list_dashboards(user: dict = Depends(get_current_user)) -> list[dict]:
    return await db.fetch_all("SELECT id,name,created_at,updated_at FROM shared_dashboards WHERE user_id=%s ORDER BY id", user["id"])


@router.post("", status_code=201)
async def create_dashboard(body: DashboardInput, user: dict = Depends(get_current_user)) -> dict:
    await validate_widgets(user["id"], body.layout)
    try:
        return await db.fetch_one("""INSERT INTO shared_dashboards(user_id,name,layout_json) VALUES(%s,%s,%s)
            RETURNING id,name,layout_json AS layout,created_at,updated_at""", user["id"], body.name.strip(), Json([w.model_dump() for w in body.layout]))
    except UniqueViolation as exc:
        raise HTTPException(409, "Dashboard name already exists") from exc


@router.get("/{dashboard_id}")
async def get_dashboard(dashboard_id: int, user: dict = Depends(get_current_user)) -> dict:
    row = await db.fetch_one("SELECT id,name,layout_json AS layout,created_at,updated_at FROM shared_dashboards WHERE id=%s AND user_id=%s", dashboard_id, user["id"])
    if not row:
        raise HTTPException(404, "Dashboard not found")
    return row


@router.put("/{dashboard_id}")
async def update_dashboard(dashboard_id: int, body: DashboardInput, user: dict = Depends(get_current_user)) -> dict:
    await validate_widgets(user["id"], body.layout)
    try:
        row = await db.fetch_one("""UPDATE shared_dashboards SET name=%s,layout_json=%s,updated_at=now()
            WHERE id=%s AND user_id=%s RETURNING id,name,layout_json AS layout,created_at,updated_at""",
            body.name.strip(), Json([w.model_dump() for w in body.layout]), dashboard_id, user["id"])
    except UniqueViolation as exc:
        raise HTTPException(409, "Dashboard name already exists") from exc
    if not row:
        raise HTTPException(404, "Dashboard not found")
    return row


@router.delete("/{dashboard_id}")
async def delete_dashboard(dashboard_id: int, user: dict = Depends(get_current_user)) -> dict:
    row = await db.fetch_one("DELETE FROM shared_dashboards WHERE id=%s AND user_id=%s RETURNING id", dashboard_id, user["id"])
    if not row:
        raise HTTPException(404, "Dashboard not found")
    return {"ok": True}
