from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("[INFO] Oil Spill Detection System - Starting up...")
    try:
        from app.database import engine
        from sqlalchemy import text
        async with engine.begin() as conn:
            try:
                await conn.execute(text("ALTER TABLE spills ADD COLUMN confidence_score FLOAT DEFAULT 0.88"))
            except Exception:
                pass
            try:
                await conn.execute(text("UPDATE spills SET confidence_score = 0.88 WHERE confidence_score IS NULL"))
            except Exception:
                pass
    except Exception as e:
        print(f"[Notice] DB migration check: {e}")

    yield
    print("[INFO] Oil Spill Detection System - Shutting down...")



app = FastAPI(
    title="Oil Spill Detection & Vessel Attribution System",
    description="Leveraging satellite imagery for oil spill detection with AIS-based vessel attribution",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
for default_origin in ("https://sarvas.vercel.app", "http://localhost:5173", "http://127.0.0.1:5173"):
    if default_origin not in origins:
        origins.append(default_origin)
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
from app.gis_routes import router as gis_router

app.include_router(auth_router)
app.include_router(spills_router)
app.include_router(vessels_router)
app.include_router(drift_router)
app.include_router(attribution_router)
app.include_router(impact_router)
app.include_router(dashboard_router)
app.include_router(reports_router)
app.include_router(gis_router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "SARVAS Backend API", "docs": "/docs"}


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "oil-spill-detection"}


@app.get("/api/limitations")
async def get_limitations():
    return {
        "limitations": [
            "INVESTIGATIVE LEAD ONLY — All attribution scores represent circumstantial mathematical likelihood, not legal proof.",
            "Candidate vessels require physical maritime verification by Coast Guard boarding parties.",
            "Radar damping cannot distinguish between heavy crude oil, fuel oil, and certain biogenic films without multispectral verification.",
            "Thickness not derivable from SAR — volume estimates are not supported.",
            "AIS gaps may stem from atmospheric conditions, receiver shadow, or deliberate transponder disabling."
        ]
    }
