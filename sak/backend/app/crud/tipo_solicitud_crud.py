"""
CRUD para Tipo de Solicitud
"""
from typing import Optional
from sqlmodel import Session

from app.core.generic_crud import GenericCRUD
from app.models import TipoSolicitud


class TipoSolicitudCRUD(GenericCRUD[TipoSolicitud]):
    """CRUD especializado para TipoSolicitud"""
    
    def delete(self, db: Session, id: int) -> Optional[TipoSolicitud]:
        """
        Elimina un tipo de solicitud
        
        Args:
            db: Sesión de base de datos
            id: ID del tipo de solicitud a eliminar
            
        Returns:
            TipoSolicitud eliminado
        """
        # Eliminación directa ya que no hay más solicitudes PO
        return super().delete(db, id)


# Instancia del CRUD especializado para TipoSolicitud
tipo_solicitud_crud = TipoSolicitudCRUD(TipoSolicitud)
