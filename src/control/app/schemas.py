from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6, max_length=128)


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    is_active: bool


class UserProfileResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    is_active: bool
    last_name: str | None = None
    first_name: str | None = None
    middle_name: str | None = None
    birth_date: date | None = None
    phone: str | None = None
    organization: str | None = None
    job_title: str | None = None
    timezone: str | None = None


class UserProfileUpdate(BaseModel):
    email: EmailStr | None = None
    last_name: str | None = Field(default=None, max_length=100)
    first_name: str | None = Field(default=None, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    birth_date: date | None = None
    phone: str | None = Field(default=None, max_length=32)
    organization: str | None = Field(default=None, max_length=200)
    job_title: str | None = Field(default=None, max_length=120)
    timezone: str | None = Field(default=None, max_length=64)
    username: str | None = None

    @field_validator("birth_date")
    @classmethod
    def birth_date_not_in_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Дата рождения не может быть в будущем")
        return value


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class DeviceResponse(BaseModel):
    id: int
    name: str
    api_key: str


class DeviceDetail(BaseModel):
    id: int
    name: str
    api_key: str
    is_active: bool
    last_seen_at: datetime | None
    created_at: datetime


class CapabilityOut(BaseModel):
    name: str
    type: Literal["number", "boolean", "string"]
    role: Literal["sensor", "actuator"]
    unit: str | None = None
    min: float | None = None
    max: float | None = None
    schema_version: int


class CapabilityIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: Literal["number", "boolean", "string"]
    role: Literal["sensor", "actuator"]
    unit: str | None = Field(default=None, max_length=50)
    min: float | None = None
    max: float | None = None


class CapabilitiesReplace(BaseModel):
    schema_version: int = Field(ge=1)
    capabilities: list[CapabilityIn]


WidgetAccent = Literal["default", "blue", "amber", "rose", "green", "slate"]


class WidgetLayout(BaseModel):
    id: str
    type: str
    metric: str
    x: int
    y: int
    w: int
    h: int
    title: str | None = None
    accent: WidgetAccent | None = None


class DashboardSummary(BaseModel):
    id: int
    device_id: int
    name: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DashboardOut(BaseModel):
    id: int
    user_id: int
    device_id: int
    name: str
    layout: list[WidgetLayout]
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DashboardCreate(BaseModel):
    name: str = Field(default="Dashboard", min_length=1, max_length=100)


class DashboardUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    layout: list[WidgetLayout]
