from fastapi import APIRouter, Depends, HTTPException, status
from psycopg.types.json import Json

from app.database import db
from app.deps import get_current_user
from app.schemas import (
    DashboardCreate,
    DashboardOut,
    DashboardSummary,
    DashboardUpdate,
    WidgetLayout,
)

router = APIRouter()


async def _get_user_device(device_id: int, user_id: int) -> dict:
    device = await db.fetch_one(
        "SELECT id FROM devices WHERE id = %s AND user_id = %s",
        device_id,
        user_id,
    )
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    return device


async def _get_user_dashboard(dashboard_id: int, user_id: int) -> dict:
    row = await db.fetch_one(
        """
        SELECT id, user_id, device_id, name, layout_json, created_at, updated_at
        FROM dashboards
        WHERE id = %s AND user_id = %s
        """,
        dashboard_id,
        user_id,
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found",
        )
    return row


def _parse_layout(layout) -> list[WidgetLayout]:
    if isinstance(layout, str):
        import json

        layout = json.loads(layout)
    return [WidgetLayout(**item) for item in (layout or [])]


def _row_to_dashboard(row: dict) -> DashboardOut:
    return DashboardOut(
        id=row["id"],
        user_id=row["user_id"],
        device_id=row["device_id"],
        name=row["name"],
        layout=_parse_layout(row["layout_json"]),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


@router.get("/device/{device_id}", response_model=list[DashboardSummary])
async def list_dashboards(
    device_id: int,
    current_user: dict = Depends(get_current_user),
) -> list[DashboardSummary]:
    user_id = current_user["id"]
    await _get_user_device(device_id, user_id)
    rows = await db.fetch_all(
        """
        SELECT id, device_id, name, created_at, updated_at
        FROM dashboards
        WHERE user_id = %s AND device_id = %s
        ORDER BY created_at ASC
        """,
        user_id,
        device_id,
    )
    return [DashboardSummary(**row) for row in rows]


@router.post(
    "/device/{device_id}",
    response_model=DashboardOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_dashboard(
    device_id: int,
    body: DashboardCreate,
    current_user: dict = Depends(get_current_user),
) -> DashboardOut:
    user_id = current_user["id"]
    await _get_user_device(device_id, user_id)

    name = body.name.strip() or "Dashboard"
    try:
        row = await db.fetch_one(
            """
            INSERT INTO dashboards (user_id, device_id, name, layout_json)
            VALUES (%s, %s, %s, %s)
            RETURNING id, user_id, device_id, name, layout_json, created_at, updated_at
            """,
            user_id,
            device_id,
            name,
            Json([]),
        )
    except Exception as exc:
        if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dashboard with name '{name}' already exists",
            ) from exc
        raise

    return _row_to_dashboard(row)


@router.get("/{dashboard_id}", response_model=DashboardOut)
async def get_dashboard(
    dashboard_id: int,
    current_user: dict = Depends(get_current_user),
) -> DashboardOut:
    row = await _get_user_dashboard(dashboard_id, current_user["id"])
    return _row_to_dashboard(row)


@router.put("/{dashboard_id}", response_model=DashboardOut)
async def update_dashboard(
    dashboard_id: int,
    body: DashboardUpdate,
    current_user: dict = Depends(get_current_user),
) -> DashboardOut:
    await _get_user_dashboard(dashboard_id, current_user["id"])
    layout_json = Json([widget.model_dump(exclude_none=True) for widget in body.layout])
    try:
        row = await db.fetch_one(
            """
            UPDATE dashboards
            SET name = %s,
                layout_json = %s,
                updated_at = NOW()
            WHERE id = %s AND user_id = %s
            RETURNING id, user_id, device_id, name, layout_json, created_at, updated_at
            """,
            body.name.strip(),
            layout_json,
            dashboard_id,
            current_user["id"],
        )
    except Exception as exc:
        if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dashboard with name '{body.name}' already exists",
            ) from exc
        raise

    return _row_to_dashboard(row)


@router.delete("/{dashboard_id}", status_code=status.HTTP_200_OK)
async def delete_dashboard(
    dashboard_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    await _get_user_dashboard(dashboard_id, current_user["id"])
    await db.execute(
        "DELETE FROM dashboards WHERE id = %s AND user_id = %s",
        dashboard_id,
        current_user["id"],
    )
    return {"status": "ok", "message": "Dashboard deleted"}
