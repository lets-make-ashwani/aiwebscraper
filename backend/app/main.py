import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.app.config import settings
# Database session initialization is handled directly inside session.py via PyMongo client
from backend.app.routes import auth, leads, dashboard, export, settings as settings_route, campaigns

app = FastAPI(
    title="LeadForge AI API",
    description="Backend API for AI-powered Lead Finder and Website Auditor SaaS",
    version="1.0.0"
)

# Configure CORS
# NextJS default port is 3000, standard dev configurations supported
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development allow all, lock down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(settings_route.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "LeadForge AI API",
        "database": settings.DATABASE_URL.split("://")[0]
    }

if __name__ == "__main__":
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
