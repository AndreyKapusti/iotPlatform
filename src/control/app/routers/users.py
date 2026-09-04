from fastapi import APIRouter, Depends, HTTPException, status

from app.database import db
from app.deps import get_current_user
from app.schemas import UserProfileResponse, UserProfileUpdate

router = APIRouter()

_USER_PROFILE_COLUMNS = (
    "id, email, username, is_active, "
    "last_name, first_name, middle_name, birth_date, "
    "phone, organization, job_title, timezone"
)


def _to_profile_response(user: dict) -> UserProfileResponse:
    return UserProfileResponse(**user)


@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: dict = Depends(get_current_user)) -> UserProfileResponse:
    return _to_profile_response(current_user)


@router.patch("/me", response_model=UserProfileResponse)
async def update_me(
    body: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
) -> UserProfileResponse:
    if body.username is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя пользователя нельзя изменить",
        )

    updates = body.model_dump(exclude_unset=True, exclude={"username"})
    if not updates:
        return _to_profile_response(current_user)

    if "email" in updates and updates["email"] != current_user["email"]:
        existing = await db.fetch_one(
            "SELECT id FROM users WHERE email = %s AND id != %s",
            updates["email"],
            current_user["id"],
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Пользователь с таким email уже существует",
            )

    set_clauses = [f"{column} = %s" for column in updates]
    set_clauses.append("updated_at = NOW()")
    values = list(updates.values()) + [current_user["id"]]

    user = await db.fetch_one(
        f"""
        UPDATE users
        SET {", ".join(set_clauses)}
        WHERE id = %s
        RETURNING {_USER_PROFILE_COLUMNS}
        """,
        *values,
    )
    return _to_profile_response(user)
