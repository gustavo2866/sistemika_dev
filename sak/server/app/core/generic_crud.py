from __future__ import annotations
import json
from typing import Any, Dict, Generic, Optional, Sequence, Type, TypeVar, Union, Tuple, List
from datetime import datetime
from sqlmodel import SQLModel, Session, select, func, and_, or_
from sqlalchemy.orm import selectinload
from app.models.base import campos_editables

M = TypeVar("M", bound=SQLModel)

class FilterOperator:
    """Operadores de filtro soportados"""
    EQ = "eq"          # igualdad
    IN = "in"          # conjunto
    GTE = "gte"        # mayor o igual
    GT = "gt"          # mayor que
    LTE = "lte"        # menor o igual
    LT = "lt"          # menor que
    IS = "is"          # para null checks
    LIKE = "like"      # texto (case insensitive)

class GenericCRUD(Generic[M]):
    def __init__(self, model: Type[M]):
        self.model: Type[M] = model
        # Obtener campos de búsqueda desde metadata del modelo
        self.searchable_fields = getattr(model, '__searchable_fields__', [])

    # --- helpers ---
    def _clean_create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        allowed = campos_editables(self.model)
        return {k: v for k, v in data.items() if k in allowed}

    def _extract_update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        allowed = campos_editables(self.model)
        # Excluir version del update normal (se maneja por separado)
        return {k: v for k, v in data.items() if k in allowed and k != "version"}

    def _apply_filters(self, stmt, filters: Dict[str, Any]):
        """Aplica filtros al statement SQL"""
        for field_name, filter_value in filters.items():
            if field_name == "q":
                # Búsqueda de texto en campos searchable
                stmt = self._apply_text_search(stmt, filter_value)
                continue
            
            # Verificar si es un campo anidado (contiene punto)
            if "." in field_name:
                stmt = self._apply_nested_filter(stmt, field_name, filter_value)
                continue
            
            # Verificar que el campo exista en el modelo
            if not hasattr(self.model, field_name):
                continue
                
            column = getattr(self.model, field_name)
            
            if isinstance(filter_value, dict):
                # Filtros complejos: {"gte": 10, "lt": 100}
                for operator, value in filter_value.items():
                    stmt = self._apply_operator_filter(stmt, column, operator, value)
            elif isinstance(filter_value, list):
                # Filtro de array: usar operador IN para múltiples valores
                stmt = stmt.where(column.in_(filter_value))
            else:
                # Filtro simple: intentar LIKE para búsqueda de texto, fallback a igualdad
                try:
                    # Para campos conocidos de texto, usar LIKE
                    if field_name in ['nombre', 'email', 'telefono', 'descripcion', 'description', 'title', 'name']:
                        stmt = stmt.where(column.ilike(f"%{filter_value}%"))
                    else:
                        # Para otros campos, intentar igualdad exacta
                        stmt = stmt.where(column == filter_value)
                except Exception as e:
                    # Si falla, intentar igualdad exacta como fallback
                    try:
                        stmt = stmt.where(column == filter_value)
                    except Exception:
                        # Si todo falla, ignorar este filtro para evitar que se caiga el servidor
                        continue
                
        return stmt

    def _apply_nested_filter(self, stmt, field_path: str, filter_value):
        """Aplica filtros para campos anidados como user.pais_id o user.company.country.name"""
        try:
            parts = field_path.split('.')
            current_model = self.model
            
            print(f"DEBUG: Aplicando filtro anidado {field_path} = {filter_value}")
            print(f"DEBUG: Partes: {parts}")
            print(f"DEBUG: Modelo inicial: {current_model.__name__}")
            
            # Navegar a través de todas las relaciones excepto la última parte
            for i, relation_name in enumerate(parts[:-1]):
                print(f"DEBUG: Procesando relación {i+1}/{len(parts)-1}: {relation_name}")
                if hasattr(current_model, relation_name):
                    relation = getattr(current_model, relation_name)
                    related_model = relation.property.mapper.class_
                    print(f"DEBUG: Join {current_model.__name__} -> {related_model.__name__}")
                    
                    # Realizar el join
                    stmt = stmt.join(related_model)
                    # Actualizar el modelo actual
                    current_model = related_model
                else:
                    print(f"ERROR: Relación {relation_name} no encontrada en {current_model.__name__}")
                    return stmt
            
            # Aplicar filtro en el campo final
            field_name = parts[-1]
            print(f"DEBUG: Aplicando filtro final en campo {field_name} del modelo {current_model.__name__}")
            
            if hasattr(current_model, field_name):
                final_column = getattr(current_model, field_name)
                if isinstance(filter_value, list):
                    stmt = stmt.where(final_column.in_(filter_value))
                    print(f"DEBUG: Filtro IN aplicado: {field_name} IN {filter_value}")
                else:
                    stmt = stmt.where(final_column == filter_value)
                    print(f"DEBUG: Filtro igualdad aplicado: {field_name} = {filter_value}")
            else:
                print(f"ERROR: Campo {field_name} no encontrado en {current_model.__name__}")
                
        except Exception as e:
            print(f"ERROR: No se pudo aplicar filtro anidado {field_path}: {e}")
            import traceback
            traceback.print_exc()
        return stmt

    def _apply_text_search(self, stmt, search_text: str):
        """Aplica búsqueda de texto en campos searchable"""
        conditions = []
        for field_name in self.searchable_fields:
            if hasattr(self.model, field_name):
                column = getattr(self.model, field_name)
                try:
                    conditions.append(column.ilike(f"%{search_text}%"))
                except:
                    conditions.append(column.like(f"%{search_text}%"))
        
        if conditions:
            stmt = stmt.where(or_(*conditions))
        return stmt

    def _apply_operator_filter(self, stmt, column, operator: str, value):
        """Aplica un operador específico a una columna"""
        if operator == FilterOperator.GTE:
            return stmt.where(column >= value)
        elif operator == FilterOperator.GT:
            return stmt.where(column > value)
        elif operator == FilterOperator.LTE:
            return stmt.where(column <= value)
        elif operator == FilterOperator.LT:
            return stmt.where(column < value)
        elif operator == FilterOperator.IN:
            return stmt.where(column.in_(value))
        elif operator == FilterOperator.IS:
            if value is None:
                return stmt.where(column.is_(None))
            else:
                return stmt.where(column.is_not(None))
        elif operator == FilterOperator.LIKE:
            return stmt.where(column.ilike(f"%{value}%"))
        else:
            # Fallback a igualdad
            return stmt.where(column == value)

    def _apply_soft_delete_filter(self, stmt, deleted: str = "exclude"):
        """Aplica filtro de soft delete"""
        if not hasattr(self.model, "deleted_at"):
            return stmt
            
        if deleted == "exclude":
            return stmt.where(self.model.deleted_at.is_(None))
        elif deleted == "only":
            return stmt.where(self.model.deleted_at.is_not(None))
        # "include" no aplica filtro
        return stmt

    # --- CRUD ---
    def create(self, session: Session, data: Dict[str, Any]) -> M:
        """Create: ignora id/stamps y campos no válidos"""
        cleaned = self._clean_create(data)
        obj = self.model(**cleaned)
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    def get(self, session: Session, obj_id: Any, deleted: str = "exclude") -> Optional[M]:
        """Get by ID con soporte para soft delete"""
        print(f"DEBUG: GenericCRUD.get called for {self.model.__name__} with id {obj_id}")
        stmt = select(self.model).where(self.model.id == obj_id)
        stmt = self._apply_soft_delete_filter(stmt, deleted)
        
        # Apply auto-includes (including nested relationships)
        stmt = self._apply_auto_includes(stmt)
        
        return session.exec(stmt).first()

    def list(
        self,
        session: Session,
        *,
        page: int = 1,
        per_page: int = 25,
        sort_by: str = "created_at",
        sort_dir: str = "asc",
        filters: Optional[Dict[str, Any]] = None,
        deleted: str = "exclude",
        fields: Optional[str] = None,
        include: Optional[str] = None,
    ) -> Tuple[Sequence[M], int]:
        """
        List con paginación y filtros
        Returns: (items, total_count)
        """
        # Base query
        stmt = select(self.model)
        
        # Apply auto-includes (including nested relationships)
        stmt = self._apply_auto_includes(stmt)
        
        # Aplicar joins para relaciones incluidas
        if include:
            include_list = [rel.strip() for rel in include.split(",")]
            for relation in include_list:
                try:
                    if hasattr(self.model, relation):
                        stmt = stmt.options(selectinload(getattr(self.model, relation)))
                except Exception as e:
                    # Log the error but don't fail the entire query
                    print(f"Warning: Could not load relationship {relation} for {self.model.__name__}: {e}")
                    pass
        
        # Aplicar filtros
        if filters:
            stmt = self._apply_filters(stmt, filters)
        
        # Aplicar soft delete
        stmt = self._apply_soft_delete_filter(stmt, deleted)
        
        # Contar total (antes de paginación)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = session.exec(count_stmt).one()
        
        # Aplicar ordenamiento
        if hasattr(self.model, sort_by):
            order_column = getattr(self.model, sort_by)
            if sort_dir.lower() == "desc":
                stmt = stmt.order_by(order_column.desc())
            else:
                stmt = stmt.order_by(order_column.asc())
        
        # Aplicar paginación
        offset = (page - 1) * per_page
        stmt = stmt.offset(offset).limit(per_page)
        
        items = session.exec(stmt).all()
        return items, total

    def _get_auto_include(self) -> List[str]:
        """Get auto-include relationships for specific models"""
        try:
            if self.model.__name__ == "Item":
                return ["user"]  # Always include user for Item
            elif self.model.__name__ == "User":
                return ["pais"]  # Always include pais for User
            elif self.model.__name__ == "Tarea":
                return ["user"]  # Always include user for Tarea
        except Exception:
            pass
        return []

    def _apply_auto_includes(self, stmt):
        """Apply auto-include relationships with nested support"""
        try:
            print(f"DEBUG: Applying auto-includes for model: {self.model.__name__}")
            if self.model.__name__ == "Item":
                print("DEBUG: Adding selectinload for Item.user.pais")
                # Import models locally to avoid circular imports
                from app.models.user import User
                stmt = stmt.options(
                    selectinload(self.model.user).selectinload(User.pais)
                )
            elif self.model.__name__ == "User":
                print("DEBUG: Adding selectinload for User.pais")
                stmt = stmt.options(selectinload(self.model.pais))
        except Exception as e:
            print(f"ERROR: Could not apply auto-includes for {self.model.__name__}: {e}")
            import traceback
            traceback.print_exc()
        return stmt

    def update(
        self, 
        session: Session, 
        obj_id: Any, 
        data: Dict[str, Any],
        check_version: bool = True
    ) -> Optional[M]:
        """
        Update completo con lock optimista
        """
        obj = self.get(session, obj_id)
        if not obj:
            return None

        # Verificar version para lock optimista
        if check_version and "version" in data:
            if hasattr(obj, "version") and obj.version != data["version"]:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "CONFLICT",
                        "message": "La versión del recurso ha cambiado",
                        "details": {
                            "current_version": obj.version,
                            "provided_version": data["version"]
                        }
                    }
                )

        # Aplicar cambios
        cambios = self._extract_update(data)
        for k, v in cambios.items():
            setattr(obj, k, v)

        # Actualizar timestamps y version
        if hasattr(obj, "updated_at"):
            setattr(obj, "updated_at", datetime.utcnow())
        if hasattr(obj, "version"):
            setattr(obj, "version", obj.version + 1)

        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    def update_partial(self, session: Session, obj_id: Any, data: Dict[str, Any]) -> Optional[M]:
        """Update parcial: sólo aplica los campos recibidos"""
        return self.update(session, obj_id, data, check_version=False)

    def delete(self, session: Session, obj_id: Any, hard: bool = False) -> bool:
        """
        Delete con soporte para soft delete
        """
        obj = self.get(session, obj_id)
        if not obj:
            return False
            
        if hard or not hasattr(obj, "deleted_at"):
            # Hard delete
            session.delete(obj)
        else:
            # Soft delete
            setattr(obj, "deleted_at", datetime.utcnow())
            if hasattr(obj, "updated_at"):
                setattr(obj, "updated_at", datetime.utcnow())
            session.add(obj)
            
        session.commit()
        return True
