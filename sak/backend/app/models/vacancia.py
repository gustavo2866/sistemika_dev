"""
Modelo Vacancia - Registro de ciclos de vacancia de propiedades.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship
from .base import Base

if TYPE_CHECKING:
    from .propiedad import Propiedad


class Vacancia(Base, table=True):
    """
    Registro de ciclos de vacancia de propiedades.
    Cada registro representa un ciclo completo desde que la propiedad
    queda disponible hasta que vuelve a ser alquilada.
    """
    
    __tablename__ = 'vacancias'
    
    # Relación con Propiedad
    propiedad_id: int = Field(foreign_key='propiedades.id', index=True)
    propiedad: Optional['Propiedad'] = Relationship(back_populates='vacancias')
    
    # Indicadores de ciclo
    ciclo_activo: bool = Field(
        default=True,
        description="Indica si el ciclo de vacancia está actualmente activo"
    )
    
    # Fechas de estados (registro cronológico)
    fecha_recibida: Optional[datetime] = Field(
        default=None,
        description="Fecha en que la propiedad fue recibida (inicio del ciclo)"
    )
    comentario_recibida: Optional[str] = Field(default=None, max_length=500)
    
    fecha_en_reparacion: Optional[datetime] = Field(
        default=None,
        description="Fecha en que comenzó el acondicionamiento"
    )
    comentario_en_reparacion: Optional[str] = Field(default=None, max_length=500)
    
    fecha_disponible: Optional[datetime] = Field(
        default=None,
        description="Fecha en que quedó disponible para alquilar"
    )
    comentario_disponible: Optional[str] = Field(default=None, max_length=500)
    
    fecha_alquilada: Optional[datetime] = Field(
        default=None,
        description="Fecha en que fue alquilada (fin del ciclo)"
    )
    comentario_alquilada: Optional[str] = Field(default=None, max_length=500)
    
    fecha_retirada: Optional[datetime] = Field(
        default=None,
        description="Fecha en que fue retirada del sistema (fin del ciclo)"
    )
    comentario_retirada: Optional[str] = Field(default=None, max_length=500)
    
    # Métricas calculadas (se calculan dinámicamente si ciclo activo)
    dias_reparacion: Optional[int] = Field(
        default=None,
        description="Días en reparación. Si ciclo activo y disponible: hoy - en_reparacion"
    )
    
    dias_disponible: Optional[int] = Field(
        default=None,
        description="Días disponible. Si ciclo activo y disponible: hoy - disponible"
    )
    
    dias_totales: Optional[int] = Field(
        default=None,
        description="Días totales del ciclo. Si ciclo activo: hoy - recibida"
    )
    
    # Configuración de API
    __searchable_fields__ = ['propiedad_id', 'ciclo_activo']
    __expanded_list_relations__ = ['propiedad']  # Siempre expandir propiedad
    
    @property
    def dias_reparacion_calculado(self) -> Optional[int]:
        """Calcula días en reparación considerando si el ciclo está activo."""
        if not self.fecha_en_reparacion:
            return None
        
        fecha_fin = self.fecha_disponible or (datetime.utcnow() if self.ciclo_activo else None)
        if not fecha_fin:
            return None
            
        return (fecha_fin - self.fecha_en_reparacion).days
    
    @property
    def dias_disponible_calculado(self) -> Optional[int]:
        """Calcula días disponible considerando si el ciclo está activo."""
        if not self.fecha_disponible:
            return None
        
        fecha_fin = self.fecha_alquilada or (datetime.utcnow() if self.ciclo_activo else None)
        if not fecha_fin:
            return None
            
        return (fecha_fin - self.fecha_disponible).days
    
    @property
    def dias_totales_calculado(self) -> Optional[int]:
        """Calcula días totales del ciclo considerando si está activo."""
        if not self.fecha_recibida:
            return None
        
        # Si ciclo activo, hasta hoy; si cerrado, hasta fecha de cierre
        if self.ciclo_activo:
            fecha_fin = datetime.utcnow()
        else:
            fecha_fin = self.fecha_alquilada or self.fecha_retirada
        
        if not fecha_fin:
            return None
            
        return (fecha_fin - self.fecha_recibida).days
    
    def __str__(self) -> str:
        estado = "Activo" if self.ciclo_activo else "Cerrado"
        return f"Vacancia(id={self.id}, propiedad_id={self.propiedad_id}, {estado})"
