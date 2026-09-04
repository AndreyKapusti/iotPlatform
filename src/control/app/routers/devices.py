import secrets

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import db
from app.deps import get_current_user
from app.schemas import (
    CapabilitiesReplace,
    CapabilityOut,
    DeviceCreate,
    DeviceDetail,
    DeviceResponse,
)

router = APIRouter()

MAX_DEVICES_PER_USER = 10


async def _get_user_device(device_id: int, user_id: int) -> dict:
    device = await db.fetch_one(
        """
        SELECT id, name, api_key, is_active, last_seen_at, created_at
        FROM devices
        WHERE id = %s AND user_id = %s
        """,
        device_id,
        user_id,
    )
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    return device


def _generate_api_key() -> str:
    return secrets.token_urlsafe(32)


@router.post("/", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_device(
    device_data: DeviceCreate,
    current_user: dict = Depends(get_current_user),
) -> DeviceResponse:
    user_id = current_user["id"]

    devices_count = await db.fetch_val(
        "SELECT COUNT(*) FROM devices WHERE user_id = %s",
        user_id,
    )
    if devices_count >= MAX_DEVICES_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 devices per user",
        )

    api_key = _generate_api_key()
    try:
        row = await db.fetch_one(
            """
            INSERT INTO devices (name, api_key, user_id)
            VALUES (%s, %s, %s)
            RETURNING id, name, api_key
            """,
            device_data.name,
            api_key,
            user_id,
        )
    except Exception as exc:
        if "duplicate key" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a device with name '{device_data.name}'",
            ) from exc
        raise

    return DeviceResponse(id=row["id"], name=row["name"], api_key=row["api_key"])


@router.get("/", response_model=list[DeviceDetail])
async def list_devices(current_user: dict = Depends(get_current_user)) -> list[DeviceDetail]:
    rows = await db.fetch_all(
        """
        SELECT id, name, api_key, is_active, last_seen_at, created_at
        FROM devices
        WHERE user_id = %s
        ORDER BY created_at DESC
        """,
        current_user["id"],
    )
    return [DeviceDetail(**row) for row in rows]


@router.get("/{device_id}", response_model=DeviceDetail)
async def get_device(
    device_id: int,
    current_user: dict = Depends(get_current_user),
) -> DeviceDetail:
    device = await _get_user_device(device_id, current_user["id"])
    return DeviceDetail(**device)


@router.delete("/{device_id}", status_code=status.HTTP_200_OK)
async def delete_device(
    device_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    await _get_user_device(device_id, current_user["id"])
    await db.execute(
        "DELETE FROM devices WHERE id = %s AND user_id = %s",
        device_id,
        current_user["id"],
    )
    return {"status": "ok", "message": "Device deleted"}


@router.post("/{device_id}/regenerate-key", response_model=DeviceResponse)
async def regenerate_api_key(
    device_id: int,
    current_user: dict = Depends(get_current_user),
) -> DeviceResponse:
    device = await _get_user_device(device_id, current_user["id"])
    new_api_key = _generate_api_key()
    await db.execute(
        "UPDATE devices SET api_key = %s WHERE id = %s AND user_id = %s",
        new_api_key,
        device_id,
        current_user["id"],
    )
    return DeviceResponse(id=device["id"], name=device["name"], api_key=new_api_key)


@router.get("/{device_id}/capabilities", response_model=list[CapabilityOut])
async def list_capabilities(
    device_id: int,
    current_user: dict = Depends(get_current_user),
) -> list[CapabilityOut]:
    await _get_user_device(device_id, current_user["id"])
    rows = await db.fetch_all(
        """
        SELECT name, data_type, role, unit, min_value, max_value, schema_version
        FROM device_capabilities
        WHERE device_id = %s
        ORDER BY name
        """,
        device_id,
    )
    return [
        CapabilityOut(
            name=row["name"],
            type=row["data_type"],
            role=row["role"],
            unit=row["unit"],
            min=row["min_value"],
            max=row["max_value"],
            schema_version=row["schema_version"],
        )
        for row in rows
    ]


@router.put("/{device_id}/capabilities", response_model=list[CapabilityOut])
async def replace_capabilities(
    device_id: int,
    body: CapabilitiesReplace,
    current_user: dict = Depends(get_current_user),
) -> list[CapabilityOut]:
    await _get_user_device(device_id, current_user["id"])

    insert_params = [
        (
            device_id,
            cap.name,
            cap.type,
            cap.role,
            cap.unit,
            cap.min,
            cap.max,
            body.schema_version,
        )
        for cap in body.capabilities
    ]

    async with db.transaction() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "DELETE FROM device_capabilities WHERE device_id = %s",
                (device_id,),
            )
            if insert_params:
                await cur.executemany(
                    """
                    INSERT INTO device_capabilities (
                        device_id, name, data_type, role, unit, min_value, max_value, schema_version
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    insert_params,
                )

    return await list_capabilities(device_id, current_user)
