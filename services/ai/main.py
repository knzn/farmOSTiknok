"""
Tiknok AI Microservice
Python 3.11 + FastAPI

This is the ONLY place Claude API calls live.
The Node.js Fastify API calls this service via AI_SERVICE_URL.

Capabilities (added per phase):
- Phase 2: Photo breed tagging, color detection, bloodline inference
- Phase 3: Highlight clip extraction, fight outcome detection, auto-captions
- Phase 4: Location-based derby event recommendations
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import anthropic
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI microservice starting...")
    yield
    logger.info("AI microservice shutting down...")


app = FastAPI(
    title="Tiknok AI",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restricted to internal network in prod
    allow_methods=["*"],
    allow_headers=["*"],
)

# Anthropic client — ANTHROPIC_API_KEY is read from env automatically
claude = anthropic.Anthropic()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "tiknok-ai"}


# ─── Phase 2: Photo Analysis ──────────────────────────────────────────────────

@app.post("/analyze/photo")
async def analyze_photo(payload: dict):
    """
    Analyze a gamefowl photo using Claude Vision.
    Returns: breed tags, color, bloodline hints, suggested caption.

    Phase 2 — not yet implemented.
    """
    return {"status": "not_implemented", "phase": 2}


# ─── Phase 3: Video Analysis ──────────────────────────────────────────────────

@app.post("/analyze/video")
async def analyze_video(payload: dict):
    """
    Analyze a fight video clip.
    Returns: highlight timestamps, outcome detection, auto-caption.

    Phase 3 — not yet implemented.
    """
    return {"status": "not_implemented", "phase": 3}


# ─── Phase 4: Event Recommendations ──────────────────────────────────────────

@app.post("/recommend/events")
async def recommend_events(payload: dict):
    """
    Recommend nearby derby events based on user location + history.

    Phase 4 — not yet implemented.
    """
    return {"status": "not_implemented", "phase": 4}
