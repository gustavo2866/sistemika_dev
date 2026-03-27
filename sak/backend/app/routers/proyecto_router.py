from datetime import UTC, datetime
from typing import Dict
from sqlmodel import Session

from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.models.proyecto import Proyecto
from app.models.proyecto_avance import ProyectoAvance
from app.models.crm.contacto import CRMContacto
from app.models.crm.oportunidad import CRMOportunidad
from app.models.enums import EstadoOportunidad


class ProyectoCRUD(NestedCRUD):
    """CRUD personalizado para Proyecto que crea automáticamente contacto y oportunidad."""
    
    def create(self, session: Session, data: Dict):
        data_copy = dict(data)
        nested_payloads = self._extract_nested_payloads(data_copy)
        
        try:
            # 1. Crear el proyecto base (sin commit automático)
            from app.core.generic_crud import GenericCRUD
            proyecto = GenericCRUD.create(self, session, data_copy, auto_commit=False)
            
            # 2. Crear contacto automático
            contacto_data = {
                "nombre_completo": f"proyecto: {proyecto.nombre}",  # Con prefijo "proyecto:"
                "responsable_id": proyecto.responsable_id,
                "notas": f"Contacto creado automáticamente para proyecto: {proyecto.nombre}"
            }
            contacto = CRMContacto(**contacto_data)
            session.add(contacto)
            session.flush()  # Para obtener el ID del contacto
            
            # 3. Crear oportunidad automática
            oportunidad_data = {
                "titulo": proyecto.nombre,  # Título igual al nombre del proyecto
                "contacto_id": contacto.id,
                "tipo_operacion_id": 4,  # ID 4 = "proyecto"
                "responsable_id": proyecto.responsable_id,
                "estado": EstadoOportunidad.PROSPECT.value,
                "activo": True,
                "fecha_estado": datetime.now(UTC),
                "descripcion": f"Oportunidad creada automáticamente para proyecto: {proyecto.nombre}"
            }
            oportunidad = CRMOportunidad(**oportunidad_data)
            session.add(oportunidad)
            session.flush()  # Para obtener el ID de la oportunidad
            
            # 4. Vincular oportunidad al proyecto
            proyecto.oportunidad_id = oportunidad.id
            session.add(proyecto)
            
            # 5. Manejar relaciones anidadas si las hay
            if nested_payloads:
                self._sync_nested_relations(session, proyecto, nested_payloads, is_create=True)
            
            session.commit()
            session.refresh(proyecto)
            return proyecto
            
        except Exception:
            session.rollback()
            raise


# CRUD con relación anidada para avances de proyecto y creación automática
proyecto_crud = ProyectoCRUD(
    Proyecto,
    nested_relations={
        "avances": {
            "model": ProyectoAvance,
            "fk_field": "proyecto_id",
            "allow_delete": True,
        }
    },
)

# Crear router generico
proyecto_router = create_generic_router(
    model=Proyecto,
    crud=proyecto_crud,
    prefix="/proyectos",
    tags=["proyectos"],
)
