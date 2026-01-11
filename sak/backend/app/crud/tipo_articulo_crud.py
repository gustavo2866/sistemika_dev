"""
CRUD para Tipo de Artículo con validación de borrado
"""
from typing import Optional
from sqlmodel import Session, select
from fastapi import HTTPException

from app.core.generic_crud import GenericCRUD
from app.models import TipoArticulo, Articulo


class TipoArticuloCRUD(GenericCRUD[TipoArticulo]):
    """CRUD especializado para TipoArticulo con validación de borrado"""
    
    def delete(self, db: Session, id: int) -> Optional[TipoArticulo]:
        """
        Elimina un tipo de artículo verificando que no tenga artículos asociados
        
        Args:
            db: Sesión de base de datos
            id: ID del tipo de artículo a eliminar
            
        Returns:
            TipoArticulo eliminado o None si no existe
            
        Raises:
            HTTPException: Si hay artículos asociados al tipo
        """
        # Verificar si existen artículos asociados
        articulos = db.exec(
            select(Articulo).where(Articulo.tipo_articulo_id == id)
        ).first()
        
        if articulos:
            raise HTTPException(
                status_code=400,
                detail=f"No se puede eliminar el tipo de artículo porque tiene artículos asociados"
            )
        
        # Si no hay artículos asociados, proceder con el borrado
        return super().delete(db, id)


# Instancia del CRUD
tipo_articulo_crud = TipoArticuloCRUD(TipoArticulo)