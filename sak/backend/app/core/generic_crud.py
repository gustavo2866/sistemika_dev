from __future__ import annotations
import json
import inspect
from typing import Any, Dict, Generic, Optional, Sequence, Type, TypeVar, Union, Tuple, List, get_args, get_origin
from datetime import UTC, datetime, date
from decimal import Decimal
from sqlmodel import SQLModel, Session, select, func, and_, or_
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.inspection import inspect as sqlalchemy_inspect
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
        # Obtener campos de bÃºsqueda desde metadata del modelo
        self.searchable_fields = getattr(model, '__searchable_fields__', [])

    # --- helpers ---
    def _coerce_field_value(self, field_name: str, value: Any) -> Any:
        """
        Convierte valores entrantes (provenientes de JSON) al tipo Python esperado
        segÃºn la anotaciÃ³n del modelo. Maneja casos comunes: datetime, date, bool,
        enteros/decimales y strings vacÃ­os.
        """
        if value is None:
            return None

        try:
            field_info = getattr(self.model, "model_fields", {}).get(field_name)
            expected_type = getattr(field_info, "annotation", None) if field_info else None

            # Desempaquetar Optional[T] para permitir la coercion correcta
            if expected_type is not None:
                origin = get_origin(expected_type)
                if origin is Union:
                    args = [arg for arg in get_args(expected_type) if arg is not type(None)]
                    if len(args) == 1:
                        expected_type = args[0]

            # Normalizar strings vacÃ­os a None solo para tipos no-string
            if isinstance(value, str) and value.strip() == "":
                if expected_type is not str:
                    return None
                # Para campos string, mantener vacÃ­o
                return value

            # datetime
            if expected_type is datetime:
                if isinstance(value, str):
                    s = value
                    # Soportar sufijo 'Z'
                    if s.endswith("Z"):
                        s = s[:-1] + "+00:00"
                    try:
                        return datetime.fromisoformat(s)
                    except Exception:
                        # Intentar sÃ³lo fecha
                        try:
                            d = date.fromisoformat(s)
                            return datetime(d.year, d.month, d.day)
                        except Exception:
                            return value  # dejar pasar y que SQLAlchemy falle si corresponde
                return value

            # date
            if expected_type is date:
                if isinstance(value, str):
                    try:
                        return date.fromisoformat(value)
                    except Exception:
                        return value
                return value

            # Decimal
            if expected_type is Decimal:
                if isinstance(value, (int, float, str)):
                    try:
                        return Decimal(str(value))
                    except Exception:
                        return value
                return value

            # int
            if expected_type is int and isinstance(value, str) and value.isdigit():
                try:
                    return int(value)
                except Exception:
                    return value

            # bool desde string
            if expected_type is bool and isinstance(value, str):
                s = value.strip().lower()
                if s in ("true", "1", "yes", "on"):  # valores truthy comunes
                    return True
                if s in ("false", "0", "no", "off"):
                    return False

        except Exception:
            # En caso de cualquier problema, devolver el valor original
            return value

        return value

    def _coerce_column_value(self, column, value):
        """Intenta adaptar un valor al tipo Python asociado a una columna SQLAlchemy"""
        if value is None:
            return None
        try:
            python_type = column.type.python_type
        except (AttributeError, NotImplementedError):
            python_type = None
        if python_type is not None:
            if python_type is bool and isinstance(value, str):
                lowered = value.strip().lower()
                if lowered in ("true", "1", "yes", "on"):
                    return True
                if lowered in ("false", "0", "no", "off"):
                    return False
            try:
                return python_type(value)
            except (TypeError, ValueError):
                pass
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return value

    def _clean_create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        allowed = campos_editables(self.model)
        # Aplicar coerciÃ³n de tipos segura durante create
        cleaned: Dict[str, Any] = {}
        for k, v in data.items():
            if k in allowed:
                cleaned[k] = self._coerce_field_value(k, v)
        return cleaned

    def _extract_update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        allowed = campos_editables(self.model)
        # Excluir version del update normal (se maneja por separado)
        return {k: v for k, v in data.items() if k in allowed and k != "version"}

    def _apply_filters(self, stmt, filters: Dict[str, Any]):
        """Aplica filtros al statement SQL"""
        for field_name, filter_value in filters.items():
            if field_name == "q":
                # BÃºsqueda de texto en campos searchable
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
                # Filtro de array: usar operador IN para mÃºltiples valores
                coerced_values = [self._coerce_column_value(column, value) for value in filter_value]
                stmt = stmt.where(column.in_(coerced_values))
            else:
                # Filtro simple: intentar LIKE para bÃºsqueda de texto, fallback a igualdad
                coerced_value = self._coerce_column_value(column, filter_value)
                try:
                    # Para campos conocidos de texto, usar LIKE
                    if field_name in ['nombre', 'email', 'telefono', 'descripcion', 'description', 'title', 'name']:
                        stmt = stmt.where(column.ilike(f"%{coerced_value}%"))
                    else:
                        # Para otros campos, intentar igualdad exacta
                        stmt = stmt.where(column == coerced_value)
                except Exception as e:
                    # Si falla, intentar igualdad exacta como fallback
                    try:
                        stmt = stmt.where(column == coerced_value)
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
            
            # Navegar a travÃ©s de todas las relaciones excepto la Ãºltima parte
            for i, relation_name in enumerate(parts[:-1]):
                print(f"DEBUG: Procesando relaciÃ³n {i+1}/{len(parts)-1}: {relation_name}")
                if hasattr(current_model, relation_name):
                    relation = getattr(current_model, relation_name)
                    related_model = relation.property.mapper.class_
                    print(f"DEBUG: Join {current_model.__name__} -> {related_model.__name__}")
                    
                    # Realizar el join
                    stmt = stmt.join(related_model)
                    # Actualizar el modelo actual
                    current_model = related_model
                else:
                    print(f"ERROR: RelaciÃ³n {relation_name} no encontrada en {current_model.__name__}")
                    return stmt
            
            # Aplicar filtro en el campo final
            field_name = parts[-1]
            print(f"DEBUG: Aplicando filtro final en campo {field_name} del modelo {current_model.__name__}")
            
            if hasattr(current_model, field_name):
                final_column = getattr(current_model, field_name)
                if isinstance(filter_value, list):
                    coerced = [self._coerce_column_value(final_column, value) for value in filter_value]
                    stmt = stmt.where(final_column.in_(coerced))
                    print(f"DEBUG: Filtro IN aplicado: {field_name} IN {coerced}")
                else:
                    stmt = stmt.where(final_column == coerced)
                    print(f"DEBUG: Filtro igualdad aplicado: {field_name} = {coerced}")
            else:
                print(f"ERROR: Campo {field_name} no encontrado en {current_model.__name__}")
                
        except Exception as e:
            print(f"ERROR: No se pudo aplicar filtro anidado {field_path}: {e}")
            import traceback
            traceback.print_exc()
        return stmt

    def _apply_text_search(self, stmt, search_text: str):
        """Aplica bÃºsqueda de texto en campos searchable"""
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
        """Aplica un operador especÃ­fico a una columna"""
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
        """Create: ignora id/stamps y campos no vÃ¡lidos"""
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
        List con paginaciÃ³n y filtros
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
        
        # Contar total (antes de paginaciÃ³n)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = session.exec(count_stmt).one()
        
        # Aplicar ordenamiento
        if hasattr(self.model, sort_by):
            order_column = getattr(self.model, sort_by)
            if sort_dir.lower() == "desc":
                stmt = stmt.order_by(order_column.desc())
            else:
                stmt = stmt.order_by(order_column.asc())
        
        # Aplicar paginaciÃ³n
        offset = (page - 1) * per_page
        stmt = stmt.offset(offset).limit(per_page)
        
        items = session.exec(stmt).all()
        return items, total

    def _discover_relations(self, model_class: Type[SQLModel], max_depth: int = 2, current_depth: int = 0) -> Dict[str, Any]:
        """
        Auto-descubre relaciones SQLAlchemy en un modelo
        
        Args:
            model_class: Clase del modelo a inspeccionar
            max_depth: MÃ¡xima profundidad de relaciones anidadas
            current_depth: Profundidad actual (para recursiÃ³n)
            
        Returns:
            Dict con los selectinload options para las relaciones encontradas
        """
        if current_depth >= max_depth:
            return {}
            
        relations = {}
        
        try:
            # Usar SQLAlchemy inspector para obtener relaciones reales
            mapper = sqlalchemy_inspect(model_class)
            
            # Iterar sobre todas las relaciones del modelo
            for relationship_name, relationship in mapper.relationships.items():
                try:
                    # Obtener el modelo relacionado
                    related_model = relationship.mapper.class_
                    
                    # Crear el selectinload para esta relaciÃ³n
                    relation_attr = getattr(model_class, relationship_name)
                    
                    # Solo procesar relaciones de nivel 1 para evitar conflictos
                    if current_depth == 0:
                        # Para relaciones de primer nivel, incluir sin anidamiento por ahora
                        relations[relationship_name] = selectinload(relation_attr)
                        
                        # Auto-descubrir relaciones anidadas solo para casos especÃ­ficos
                        if current_depth < max_depth - 1:
                            try:
                                nested_relations = self._discover_relations(
                                    related_model, max_depth, current_depth + 1
                                )
                                
                                # Solo aÃ±adir relaciones anidadas si es seguro
                                if nested_relations and len(nested_relations) <= 2:
                                    # Buscar relaciones especÃ­ficas conocidas como seguras
                                    for nested_name, _ in nested_relations.items():
                                        if nested_name in ['pais', 'categoria', 'tipo']:  # Relaciones "seguras"
                                            try:
                                                nested_attr = getattr(related_model, nested_name)
                                                relations[relationship_name] = selectinload(relation_attr).selectinload(nested_attr)
                                                break  # Solo una relaciÃ³n anidada por simplicidad
                                            except:
                                                continue
                            except:
                                # Si hay error con relaciones anidadas, mantener solo la de primer nivel
                                pass
                        
                except Exception as e:
                    print(f"WARNING: Could not process relationship '{relationship_name}' in {model_class.__name__}: {e}")
                    continue
                    
        except Exception as e:
            print(f"ERROR: Could not discover relations for {model_class.__name__}: {e}")
            
        return relations

    def _get_auto_include_options(self) -> List[Any]:
        """
        Obtiene automÃ¡ticamente las opciones de include para el modelo actual
        
        Returns:
            Lista de selectinload options para usar en la query
        """
        relations = self._discover_relations(self.model, max_depth=2)
        options = []
        
        for relation_name, loader in relations.items():
            options.append(loader)
            
        print(f"DEBUG: Auto-discovered {len(options)} relations for {self.model.__name__}: {list(relations.keys())}")
        return options

    def _get_auto_include(self) -> List[str]:
        """
        DEPRECATED: Mantener por compatibilidad
        Retorna nombres de relaciones descubiertas automÃ¡ticamente
        """
        relations = self._discover_relations(self.model, max_depth=1)
        return list(relations.keys())

    def _apply_auto_includes(self, stmt):
        """
        Aplica automÃ¡ticamente las relaciones descubiertas al statement SQL
        
        Args:
            stmt: SQLAlchemy statement
            
        Returns:
            Statement con las opciones de include aplicadas
        """
        try:
            print(f"DEBUG: Auto-discovering includes for model: {self.model.__name__}")
            
            # Rehabilitar auto-discovery ahora que el problema del enum estÃ¡ resuelto
            include_options = self._get_auto_include_options()
            
            if include_options:
                print(f"DEBUG: Applying {len(include_options)} auto-discovered includes")
                stmt = stmt.options(*include_options)
            else:
                print(f"DEBUG: No auto-includes found for {self.model.__name__}")
                
            return stmt  # Â¡IMPORTANTE! Agregamos el return que faltaba
                
        except Exception as e:
            print(f"ERROR: Could not apply auto-includes for {self.model.__name__}: {e}")
            import traceback
            traceback.print_exc()
            return stmt  # Retornar stmt original en caso de error
            
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
        try:
            print(f"DEBUG CRUD.update<{self.model.__name__}> id={obj_id} incoming keys={list(data.keys())}")
            print(f"DEBUG CRUD.update incoming sample={(list(data.items())[:10])}")
        except Exception:
            pass
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
                        "message": "La versiÃ³n del recurso ha cambiado",
                        "details": {
                            "current_version": obj.version,
                            "provided_version": data["version"]
                        }
                    }
                )

        # Aplicar cambios
        cambios = self._extract_update(data)
        try:
            print(f"DEBUG CRUD.update extracted changes={cambios}")
        except Exception:
            pass
        for k, v in cambios.items():
            coerced = self._coerce_field_value(k, v)
            setattr(obj, k, coerced)

        # Actualizar timestamps y version
        if hasattr(obj, "updated_at"):
            setattr(obj, "updated_at", datetime.now(UTC))
        if hasattr(obj, "version"):
            setattr(obj, "version", obj.version + 1)

        try:
            # Mostrar un preview de valores finales para campos comunes
            preview_fields = list(cambios.keys())[:10]
            final_preview = {f: getattr(obj, f, None) for f in preview_fields}
            print(f"DEBUG CRUD.update final values preview={final_preview}")
        except Exception:
            pass

        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    def update_partial(self, session: Session, obj_id: Any, data: Dict[str, Any]) -> Optional[M]:
        """Update parcial: sÃ³lo aplica los campos recibidos"""
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
            setattr(obj, "deleted_at", datetime.now(UTC))
            if hasattr(obj, "updated_at"):
                setattr(obj, "updated_at", datetime.now(UTC))
            session.add(obj)
            
        session.commit()
        return True


