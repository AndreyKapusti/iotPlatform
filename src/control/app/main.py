import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import db
from app.routers import auth, automation, dashboards, devices, shared_dashboards, users
from app.automation import automation_worker, listen_for_telemetry

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    worker = asyncio.create_task(automation_worker())
    listener = asyncio.create_task(listen_for_telemetry())
    try:
        yield
    finally:
        worker.cancel()
        listener.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass
        try:
            await listener
        except asyncio.CancelledError:
            pass
        await db.disconnect()


app = FastAPI(
    title="SignalDeck Control API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(devices.router, prefix="/api/v1/devices", tags=["devices"])
app.include_router(dashboards.router, prefix="/api/v1/dashboards", tags=["dashboards"])
app.include_router(automation.router, prefix="/api/v1/automation", tags=["automation"])
app.include_router(shared_dashboards.router, prefix="/api/v1/shared-dashboards", tags=["shared dashboards"])


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
