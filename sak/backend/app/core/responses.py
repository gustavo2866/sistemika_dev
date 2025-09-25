from typing import Any, Dict, Generic, List, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar('T')

class DataResponse(BaseModel, Generic[T]):
    """Respuesta estándar para un item único"""
    data: T

class ListResponse(BaseModel, Generic[T]):
    """Respuesta estándar para listados con paginación"""
    data: List[T]
    total: int

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None

class ErrorResponse(BaseModel):
    error: ErrorDetail

class DeleteResponse(BaseModel):
    """Respuesta estándar para DELETE"""
    data: bool = True

# Códigos de error estándar
class ErrorCodes:
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    CONFLICT = "CONFLICT"
    PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE"
    UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE"
