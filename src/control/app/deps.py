from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.database import db
from app.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось подтвердить учётные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        username = payload.get("sub")
        if not username:
            raise credentials_exception
    except ValueError:
        raise credentials_exception

    user = await db.fetch_one(
        """
        SELECT id, email, username, is_active,
               last_name, first_name, middle_name, birth_date,
               phone, organization, job_title, timezone
        FROM users
        WHERE username = %s
        """,
        username,
    )

    if user is None or not user["is_active"]:
        raise credentials_exception

    return user
