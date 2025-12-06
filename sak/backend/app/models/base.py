from typing import Optional, Dict, Any, List, ClassVar
from datetime import UTC, datetime
from sqlmodel import SQLModel, Field

def current_utc_time() -> datetime:
    return datetime.now(UTC)

class Base(SQLModel):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=current_utc_time, nullable=False)
    updated_at: datetime = Field(default_factory=current_utc_time, nullable=False)
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
    version: int = Field(default=1, nullable=False)
    
    # Metadata para configuración del CRUD
    __searchable_fields__: ClassVar[List[str]] = []  # Campos donde buscar con "q"

STAMP_FIELDS = {"id", "created_at", "updated_at", "deleted_at", "version"}
VISIBLE_STAMP_FIELDS = {"created_at", "updated_at"}

def campos_editables(model_cls: type[SQLModel]) -> set[str]:
    """Campos editables por el usuario (para formularios de edición)"""
    return set(model_cls.model_fields.keys()) - STAMP_FIELDS

def campos_respuesta(model_cls: type[SQLModel], include_id: bool = True) -> set[str]:
    """Campos para incluir en respuestas al frontend (visualización)"""
    campos = campos_editables(model_cls)
    if include_id:
        campos.add('id')
    return campos

def filtrar_respuesta(obj: SQLModel, context: str = "display", _depth: int = 0, _visited: set = None) -> Dict[str, Any]:
    """
    Filtra un objeto para respuesta al frontend
    
    Args:
        obj: Objeto a filtrar
        context: 'display' (incluye id) o 'edit' (solo campos editables)
        _depth: Profundidad actual de recursión (interno)
        _visited: Set de objetos ya visitados para evitar ciclos (interno)
    """
    # Inicializar visited en el primer nivel
    if _visited is None:
        _visited = set()
    
    # Evitar ciclos: si ya visitamos este objeto, solo devolver su id
    obj_key = (type(obj).__name__, getattr(obj, 'id', id(obj)))
    if obj_key in _visited:
        return {"id": obj.id} if hasattr(obj, 'id') else {}
    
    _visited.add(obj_key)
    
    if context == "edit":
        # Solo campos editables (para formularios)
        campos_validos = campos_editables(type(obj))
    else:
        # Campos editables + id (para visualización)
        campos_validos = campos_respuesta(type(obj), include_id=True)
    
    obj_dict = obj.model_dump()
    
    # Incluir relaciones cargadas aprovechando _visited para evitar ciclos
    for attr_name in dir(obj):
        if attr_name.startswith('_'):
            continue
        if attr_name in obj.model_fields:
            continue
        if attr_name not in obj.__dict__:
            # Si la relación no está cargada, evitar accesos que disparen queries
            continue

        attr_value = obj.__dict__[attr_name]
        # Si es una relación cargada (tiene model_fields y no es un campo regular)
        if hasattr(attr_value, 'model_fields') and attr_name not in STAMP_FIELDS:
            obj_dict[attr_name] = filtrar_respuesta(attr_value, context, _depth + 1, _visited)
        # Si es una lista de relaciones (one-to-many)
        elif isinstance(attr_value, list) and len(attr_value) > 0 and hasattr(attr_value[0], 'model_fields'):
            expanded_relations = getattr(type(obj), "__expanded_list_relations__", set())
            if attr_name in expanded_relations:
                obj_dict[attr_name] = [
                    filtrar_respuesta(item, context, _depth + 1, _visited.copy())
                    for item in attr_value
                ]
            else:
                # Para listas, solo incluir IDs para evitar sobrecarga
                obj_dict[attr_name] = [{"id": item.id} if hasattr(item, 'id') else {} for item in attr_value]
    
    # Filtrar campos válidos más las relaciones
    result = {}
    for k, v in obj_dict.items():
        if k in campos_validos or (not k.startswith('_') and (k not in STAMP_FIELDS or k in VISIBLE_STAMP_FIELDS)):
            result[k] = v

    # Inyectar campos calculados cuando existan propiedades auxiliares
    _calculated_overrides = [
        ("dias_totales", "dias_totales_calculado"),
        ("dias_reparacion", "dias_reparacion_calculado"),
        ("dias_disponible", "dias_disponible_calculado"),
    ]
    for field_name, calculated_attr in _calculated_overrides:
        if field_name in result:
            if result[field_name] is None and hasattr(obj, calculated_attr):
                calculated_value = getattr(obj, calculated_attr)
                if calculated_value is not None:
                    result[field_name] = calculated_value
        else:
            if hasattr(obj, calculated_attr):
                calculated_value = getattr(obj, calculated_attr)
                if calculated_value is not None:
                    result[field_name] = calculated_value
    
    return result 


