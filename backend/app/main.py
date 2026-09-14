from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: could initialize model, check DB connection, etc.
    print("[INFO] Oil Spill Detection System - Starting up...")
    yield
    # Shutdown
    print("[INFO] Oil Spill Detection System - Shutting down...")



app = FastAPI(
    title="Oil Spill Detection & Vessel Attribution System",
    description="Leveraging satellite imagery for oil spill detection with AIS-based vessel attribution",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Register routers ---
from app.auth.routes import router as auth_router
from app.spills.routes import router as spills_router
from app.vessels.routes import router as vessels_router
from app.drift.routes import router as drift_router
from app.attribution.routes import router as attribution_router
from app.impact.routes import router as impact_router
from app.dashboard.routes import router as dashboard_router
from app.reports.routes import router as reports_router

app.include_router(auth_router)
app.include_router(spills_router)
app.include_router(vessels_router)
app.include_router(drift_router)
app.include_router(attribution_router)
app.include_router(impact_router)
app.include_router(dashboard_router)
app.include_router(reports_router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "SARVAS Backend API", "docs": "/docs"}


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "oil-spill-detection"}
