#!/usr/bin/env python3
"""
Endpoint de login temporal sin base de datos
Para bypasear problemas de conexión a Neon
"""

from fastapi import APIRouter
from pydantic import BaseModel
import jwt
from datetime import UTC, datetime, timedelta
import os

# Modelo para credenciales
class LoginCredentials(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    user: dict
    token: str

router = APIRouter(prefix="/auth", tags=["authentication"])

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-key")

def create_token(user_id: int) -> str:
    """Crear JWT token"""
    payload = {
        "user_id": user_id,
        "exp": datetime.now(UTC) + timedelta(hours=24),
        "iat": datetime.now(UTC)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

@router.post("/login", response_model=LoginResponse)
async def login_temp(credentials: LoginCredentials):
    """
    LOGIN TEMPORAL SIN BASE DE DATOS
    Solo para verificar que el sistema funciona
    """
    
    # Lista de usuarios válidos (sin DB)
    valid_users = {
        "demo@example.com": {"id": 1, "nombre": "Usuario Demo"},
        "admin@test.com": {"id": 2, "nombre": "Admin Test"},
        "test@example.com": {"id": 3, "nombre": "Tester"},
    }
    
    # Verificar usuario
    if credentials.username not in valid_users:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    
    user_info = valid_users[credentials.username]
    
    # Crear token
    token = create_token(user_info["id"])
    
    # Respuesta
    user_data = {
        "id": user_info["id"],
        "nombre": user_info["nombre"],
        "email": credentials.username,
        "telefono": None,
        "url_foto": None,
        "pais_id": None
    }
    
    return LoginResponse(user=user_data, token=token)

@router.get("/me")
async def get_me_temp():
    """Usuario temporal"""
    return {
        "id": 1,
        "fullName": "Usuario Demo",
        "email": "demo@example.com",
        "avatar": None
    }