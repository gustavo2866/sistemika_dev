"""
Meta WhatsApp API - Backend
FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import register_routes

# Crear aplicación FastAPI
app = FastAPI(
    title="Meta WhatsApp API",
    description="Sistema multi-empresa para gestión de mensajes de WhatsApp",
    version="1.0.0",
    debug=settings.DEBUG,
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers principales
register_routes(app)


@app.get("/")
async def root():
    """Endpoint raíz"""
    return {
        "message": "Meta WhatsApp API",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "database": "connected"}


@app.get("/api/v1/info")
async def api_info():
    """Información de la API"""
    return {
        "name": "Meta WhatsApp API",
        "version": "1.0.0",
        "endpoints": {"health": "/health", "docs": "/docs", "redoc": "/redoc"},
    }
