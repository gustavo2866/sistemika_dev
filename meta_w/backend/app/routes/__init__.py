"""
Utilities to register API routers.
"""
from fastapi import FastAPI

from . import empresas, celulares, contactos, mensajes, webhook


def register_routes(app: FastAPI):
    app.include_router(empresas.router, prefix="/api/v1")
    app.include_router(celulares.router, prefix="/api/v1")
    app.include_router(contactos.router, prefix="/api/v1")
    app.include_router(mensajes.router, prefix="/api/v1")
    app.include_router(webhook.router, prefix="/api/v1")
