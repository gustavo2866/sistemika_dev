"""
CRUD para Tipo de Solicitud con validación de borrado
"""
from typing import Optional
from sqlmodel import Session, select
from fastapi import HTTPException

from app.core.generic_crud import GenericCRUD
from app.models import TipoSolicitud, Solicitud


class TipoSolicitudCRUD(GenericCRUD[TipoSolicitud]):
    """CRUD especializado para TipoSolicitud con validación de borrado"""
    
    def delete(self, db: Session, id: int) -> Optional[TipoSolicitud]:
        """
        Elimina un tipo de solicitud verificando que no tenga solicitudes asociadas
        
        Args:
            db: Sesión de base de datos
            id: ID del tipo de solicitud a eliminar
            
        Returns:
            TipoSolicitud eliminado
            
        Raises:
            HTTPException 400: Si el tipo tiene solicitudes asociadas
        """
        # Verificar si hay solicitudes con este tipo
        statement = select(Solicitud).where(
            Solicitud.tipo_solicitud_id == id,
            Solicitud.deleted_at.is_(None)  # Solo solicitudes no eliminadas
        )
        solicitudes = db.exec(statement).first()
        
        if solicitudes:
            raise HTTPException(
                status_code=400,
                detail="No se puede eliminar el tipo de solicitud porque tiene solicitudes asociadas"
            )
        
        # Si no hay solicitudes, proceder con eliminación normal
        return super().delete(db, id)


# Instancia del CRUD especializado para TipoSolicitud
tipo_solicitud_crud = TipoSolicitudCRUD(TipoSolicitud)
