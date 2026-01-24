"""
Extensión del CRUD de mensajes para mantener actualizados los campos
ultimo_mensaje_id y ultimo_mensaje_at en la tabla crm_oportunidades.
"""

from typing import Dict, Any
from sqlmodel import Session, select, text

from app.core.generic_crud import GenericCRUD
from app.models.crm.mensaje import CRMMensaje
from app.models.crm.oportunidad import CRMOportunidad


class CRMMensajeCRUD(GenericCRUD[CRMMensaje]):
    """CRUD extendido para CRMMensaje con actualización automática de ultimo_mensaje."""
    
    def create(self, session: Session, data: Dict[str, Any]) -> CRMMensaje:
        """Crear mensaje y actualizar ultimo_mensaje en oportunidad."""
        # Crear el mensaje usando el método padre
        mensaje = super().create(session, data)
        
        # Actualizar ultimo_mensaje en oportunidad si corresponde
        self._actualizar_ultimo_mensaje_oportunidad(session, mensaje)
        
        return mensaje
    
    def update(self, session: Session, obj_id: Any, data: Dict[str, Any]) -> CRMMensaje:
        """Actualizar mensaje y recalcular ultimo_mensaje si es necesario."""
        # Obtener el mensaje antes de la actualización
        mensaje_anterior = self.get(session, obj_id)
        if not mensaje_anterior:
            raise ValueError(f"Mensaje {obj_id} no encontrado")
        
        # Actualizar usando el método padre
        mensaje = super().update(session, obj_id, data)
        
        # Si cambió la oportunidad_id o fecha_mensaje, actualizar ultimo_mensaje
        if ('oportunidad_id' in data and data['oportunidad_id'] != mensaje_anterior.oportunidad_id) or \
           ('fecha_mensaje' in data and data['fecha_mensaje'] != mensaje_anterior.fecha_mensaje):
            
            # Actualizar nueva oportunidad si existe
            if mensaje.oportunidad_id:
                self._actualizar_ultimo_mensaje_oportunidad(session, mensaje)
            
            # Recalcular anterior oportunidad si cambió
            if (mensaje_anterior.oportunidad_id and 
                mensaje_anterior.oportunidad_id != mensaje.oportunidad_id):
                self._recalcular_ultimo_mensaje_oportunidad(session, mensaje_anterior.oportunidad_id)
        
        return mensaje
    
    def delete(self, session: Session, obj_id: Any) -> bool:
        """Eliminar mensaje y recalcular ultimo_mensaje en oportunidad."""
        # Obtener el mensaje antes de eliminarlo
        mensaje = self.get(session, obj_id)
        if not mensaje:
            return False
        
        oportunidad_id = mensaje.oportunidad_id
        
        # Eliminar usando el método padre (soft delete)
        resultado = super().delete(session, obj_id)
        
        # Recalcular ultimo_mensaje si el mensaje tenía oportunidad
        if resultado and oportunidad_id:
            self._recalcular_ultimo_mensaje_oportunidad(session, oportunidad_id)
        
        return resultado
    
    def _actualizar_ultimo_mensaje_oportunidad(self, session: Session, mensaje: CRMMensaje):
        """
        Actualiza los campos ultimo_mensaje de una oportunidad con el mensaje dado.
        Solo actualiza si es más reciente que el último mensaje actual.
        """
        if not mensaje.oportunidad_id:
            return
        
        # Usar SQL directo para mejor performance y evitar problemas de concurrencia
        result = session.execute(
            text("""
                UPDATE crm_oportunidades 
                SET ultimo_mensaje_id = :mensaje_id,
                    ultimo_mensaje_at = :fecha_mensaje,
                    updated_at = NOW()
                WHERE id = :oportunidad_id
                AND (ultimo_mensaje_at IS NULL OR :fecha_mensaje >= ultimo_mensaje_at)
            """),
            {
                "mensaje_id": mensaje.id,
                "fecha_mensaje": mensaje.fecha_mensaje,
                "oportunidad_id": mensaje.oportunidad_id
            }
        )
        
        # Logging para debugging
        if result.rowcount > 0:
            print(f"✅ Actualizado ultimo_mensaje para oportunidad {mensaje.oportunidad_id}: "
                  f"mensaje_id={mensaje.id}, fecha={mensaje.fecha_mensaje}")
            # IMPORTANTE: Hacer commit para persistir la actualización
            session.commit()
        else:
            print(f"ℹ️  No se actualizó oportunidad {mensaje.oportunidad_id} "
                  f"(mensaje más antiguo o igual)")
    
    def _recalcular_ultimo_mensaje_oportunidad(self, session: Session, oportunidad_id: int):
        """
        Recalcula el último mensaje de una oportunidad.
        Útil cuando se elimina un mensaje o cambia la oportunidad_id.
        """
        # Buscar el mensaje más reciente activo de esta oportunidad
        result = session.execute(
            text("""
                UPDATE crm_oportunidades 
                SET ultimo_mensaje_id = COALESCE(ultimo_msg.mensaje_id, NULL),
                    ultimo_mensaje_at = COALESCE(ultimo_msg.fecha_mensaje, NULL),
                    updated_at = NOW()
                FROM (
                    SELECT id as mensaje_id, fecha_mensaje
                    FROM crm_mensajes 
                    WHERE oportunidad_id = :oportunidad_id 
                      AND deleted_at IS NULL
                    ORDER BY fecha_mensaje DESC, id DESC
                    LIMIT 1
                ) ultimo_msg
                WHERE crm_oportunidades.id = :oportunidad_id
            """),
            {"oportunidad_id": oportunidad_id}
        )
        
        # Si no hay mensajes, limpiar los campos
        if result.rowcount == 0:
            session.execute(
                text("""
                    UPDATE crm_oportunidades 
                    SET ultimo_mensaje_id = NULL,
                        ultimo_mensaje_at = NULL,
                        updated_at = NOW()
                    WHERE id = :oportunidad_id
                    AND ultimo_mensaje_id IS NOT NULL
                """),
                {"oportunidad_id": oportunidad_id}
            )
            print(f"🧹 Limpiados campos ultimo_mensaje para oportunidad {oportunidad_id} (sin mensajes)")
        else:
            print(f"🔄 Recalculado ultimo_mensaje para oportunidad {oportunidad_id}")
        
        # IMPORTANTE: Hacer commit para persistir los cambios
        session.commit()


# Instancia del CRUD extendido
crm_mensaje_crud = CRMMensajeCRUD(CRMMensaje)
