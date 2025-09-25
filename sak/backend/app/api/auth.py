#!/usr/bin/env python3
"""
Endpoints de autenticación específicos para login/logout
Complementa los endpoints CRUD genéricos existentes para usuarios
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr
from typing import Optional
import hashlib
import os
import jwt
from datetime import datetime, timedelta

from app.models.user import User
from app.db import get_session

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer(auto_error=False)

# Modelo para credenciales de login
class LoginCredentials(BaseModel):
    username: str  # Puede ser email o nombre de usuario
    password: str

class LoginResponse(BaseModel):
    user: dict
    token: str

class UserIdentity(BaseModel):
    id: int
    fullName: str
    email: str
    avatar: Optional[str] = None

# Secreto para JWT (en producción usar variable de entorno)
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

def hash_password(password: str) -> str:
    """Hash simple para passwords (en producción usar bcrypt)"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(user_id: int) -> str:
    """Crear JWT token para el usuario"""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> Optional[int]:
    """Verificar JWT token y retornar user_id"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("user_id")
    except jwt.PyJWTError:
        return None

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session)
) -> User:
    """Obtener usuario actual desde token JWT"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    user_id = verify_token(credentials.credentials)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user

@router.post("/login", response_model=LoginResponse)
async def login(
    credentials: LoginCredentials,
    session: Session = Depends(get_session)
):
    """
    Autenticar usuario con username/email y password
    Retorna usuario + token JWT
    """
    
    # Buscar usuario por email o nombre
    statement = select(User).where(
        (User.email == credentials.username) | 
        (User.nombre == credentials.username)
    )
    user = session.exec(statement).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # TODO: Verificar password (por ahora cualquier password es válida para desarrollo)
    # password_hash = hash_password(credentials.password)
    # if user.password != password_hash:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Invalid credentials"
    #     )
    
    # Por ahora, aceptar cualquier password para desarrollo
    # En producción, verificar contra campo password en User model
    
    # Generar token
    token = create_token(user.id)
    
    # Preparar respuesta de usuario (sin password)
    user_data = {
        "id": user.id,
        "nombre": user.nombre,
        "email": user.email,
        "telefono": user.telefono,
        "url_foto": user.url_foto,
        "pais_id": user.pais_id
    }
    
    return LoginResponse(user=user_data, token=token)

@router.post("/logout")
async def logout():
    """
    Logout del usuario (invalidar token)
    Por ahora solo retorna success, en producción invalidar token en blacklist
    """
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserIdentity)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Obtener información del usuario autenticado actual
    Formato esperado por componentes shadcn-admin-kit
    """
    return UserIdentity(
        id=current_user.id,
        fullName=f"{current_user.nombre}".strip() or current_user.email,
        email=current_user.email,
        avatar=current_user.url_foto
    )

@router.get("/check")
async def check_authentication(
    current_user: User = Depends(get_current_user)
):
    """
    Verificar si el usuario está autenticado
    Endpoint para validar token sin retornar datos
    """
    return {"authenticated": True, "user_id": current_user.id}
