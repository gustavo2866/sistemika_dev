# 📝 Template de Especificación de Cambio Backend

> **Referencia:** [README_BACKEND_v1.md](../../README_BACKEND_v1.md)  
> **Fecha de Template:** Noviembre 2025  
> **Versión:** 1.0

---

## ⚠️ INSTRUCCIONES DE USO

1. **Copiar este template** para cada cambio significativo al backend
2. **Nombrar el archivo**: `SPEC_{fecha}_{feature}.md` (ej: `SPEC_20251110_agregar_campo_prioridad.md`)
3. **Completar todas las secciones** antes de comenzar desarrollo
4. **Revisar checklist** antes de considerar el cambio completo
5. **Consultar README_BACKEND_v1.md** para mantener patrones y convenciones

---

## 📋 METADATA DEL CAMBIO

| Campo | Valor |
|-------|-------|
| **ID del Cambio** | `[Asignar ID único, ej: CHG-2024-001]` |
| **Título** | `[Título descriptivo del cambio]` |
| **Tipo** | `[ ] Nueva Entidad  [ ] Modificar Entidad  [ ] Nuevo Endpoint  [ ] Servicio  [ ] Refactor  [ ] Bugfix` |
| **Prioridad** | `[ ] Crítica  [ ] Alta  [ ] Media  [ ] Baja` |
| **Fecha Creación** | `[YYYY-MM-DD]` |
| **Autor** | `[Nombre]` |
| **Estimación** | `[Horas estimadas]` |
| **Estado** | `[ ] Planificado  [ ] En Desarrollo  [ ] Testing  [ ] Completado  [ ] Revertido` |

---

## 1. DESCRIPCIÓN FUNCIONAL

### 1.1 Resumen Ejecutivo

> **Descripción en 2-3 líneas del cambio y su propósito de negocio.**

```
[Completar aquí]
Ejemplo: "Agregar campo 'prioridad' a las solicitudes de compra para permitir 
que el usuario indique la urgencia de la solicitud (Alta, Media, Baja). 
Esto permitirá ordenar las solicitudes en el backlog por prioridad."
```

### 1.2 Justificación

**¿Por qué se necesita este cambio?**

```
[Completar aquí]
Ejemplo:
- Actualmente las solicitudes no tienen forma de indicar urgencia
- Los usuarios necesitan priorizar compras críticas
- El área de compras no puede distinguir qué solicitudes atender primero
```

### 1.3 Objetivo

**¿Qué problema resuelve?**

```
[Completar aquí]
Ejemplo:
- Permitir clasificar solicitudes por urgencia
- Facilitar toma de decisiones del área de compras
- Mejorar SLA de atención de solicitudes críticas
```

### 1.4 Alcance

**¿Qué incluye este cambio?**

- [ ] Modificación de modelo de datos
- [ ] Migración de base de datos
- [ ] Nuevos endpoints
- [ ] Modificación de endpoints existentes
- [ ] Nuevos servicios
- [ ] Modificación de servicios existentes
- [ ] Seed data / fixtures
- [ ] Tests
- [ ] Documentación

**¿Qué NO incluye?**

```
[Completar aquí]
Ejemplo: "No incluye cambios en el frontend, solo backend API"
```

### 1.5 Impacto

**¿Qué componentes se ven afectados?**

| Componente | Impacto | Descripción |
|------------|---------|-------------|
| Modelos | `[ ] Ninguno [ ] Bajo [ ] Medio [ ] Alto` | `[Descripción]` |
| CRUD | `[ ] Ninguno [ ] Bajo [ ] Medio [ ] Alto` | `[Descripción]` |
| Routers | `[ ] Ninguno [ ] Bajo [ ] Medio [ ] Alto` | `[Descripción]` |
| Servicios | `[ ] Ninguno [ ] Bajo [ ] Medio [ ] Alto` | `[Descripción]` |
| Base de Datos | `[ ] Ninguno [ ] Bajo [ ] Medio [ ] Alto` | `[Descripción]` |
| Frontend | `[ ] Ninguno [ ] Bajo [ ] Medio [ ] Alto` | `[Descripción]` |

**¿Breaking changes?**

- [ ] **NO** - Cambio compatible con versión actual
- [ ] **SÍ** - Requiere cambios en clientes/frontend

**Si hay breaking changes, describir plan de migración:**

```
[Completar aquí si aplica]
```

---

## 2. ESPECIFICACIÓN TÉCNICA

### 2.1 Arquitectura

**¿Qué patrón del README_BACKEND_v1.md se aplica?**

- [ ] Generic CRUD Pattern (sección 4.1)
- [ ] Nested CRUD Pattern (sección 4.2)
- [ ] Repository Pattern (sección 4.3)
- [ ] Factory Pattern (sección 4.4)
- [ ] Servicio personalizado (sección 8)
- [ ] Endpoint especializado (sección 9)
- [ ] Otro: `[Especificar]`

### 2.2 Modelos de Datos

#### 2.2.1 Modelos Nuevos

**¿Se crean nuevos modelos?**

```python
# Ejemplo:
# app/models/categoria_solicitud.py

from sqlmodel import SQLModel, Field
from app.models.base import Base
from typing import Optional

class CategoriaSolicitud(Base, table=True):
    __tablename__ = "categorias_solicitud"
    __searchable_fields__ = ["nombre", "descripcion"]
    
    nombre: str = Field(max_length=100, unique=True)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    activo: bool = Field(default=True)
```

#### 2.2.2 Modelos Modificados

**¿Se modifican modelos existentes?**

```python
# Ejemplo:
# app/models/solicitud.py

# ANTES:
class Solicitud(Base, table=True):
    tipo: TipoSolicitud
    fecha_necesidad: date
    # ...

# DESPUÉS:
class Solicitud(Base, table=True):
    tipo: TipoSolicitud
    fecha_necesidad: date
    prioridad: PrioridadSolicitud = Field(default=PrioridadSolicitud.MEDIA)  # ← NUEVO
    # ...

# Enum a agregar:
class PrioridadSolicitud(str, Enum):
    ALTA = "alta"
    MEDIA = "media"
    BAJA = "baja"
```

#### 2.2.3 Relaciones

**¿Se agregan/modifican relaciones?**

```python
# Ejemplo:
# Nueva relación one-to-many

class Solicitud(Base, table=True):
    # ...
    categoria_id: Optional[int] = Field(default=None, foreign_key="categorias_solicitud.id")
    categoria: Optional[CategoriaSolicitud] = Relationship(back_populates="solicitudes")

class CategoriaSolicitud(Base, table=True):
    # ...
    solicitudes: List["Solicitud"] = Relationship(back_populates="categoria")
```

### 2.3 Migraciones

#### 2.3.1 Scripts de Migración

**Comando Alembic:**

```bash
# Generar migración
alembic revision --autogenerate -m "descripción_del_cambio"

# Ejemplo:
alembic revision --autogenerate -m "add prioridad field to solicitudes"
```

**Contenido esperado del script:**

```python
# alembic/versions/XXXX_add_prioridad_to_solicitudes.py

def upgrade():
    # ADD COLUMN
    op.add_column('solicitudes', 
        sa.Column('prioridad', sa.String(20), nullable=False, server_default='media'))
    
    # Opcional: Actualizar registros existentes
    op.execute("UPDATE solicitudes SET prioridad = 'media' WHERE prioridad IS NULL")

def downgrade():
    op.drop_column('solicitudes', 'prioridad')
```

#### 2.3.2 Datos Seed

**¿Se requiere seed data?**

- [ ] NO
- [ ] SÍ - Describir a continuación

**Script de seed:**

```python
# scripts/seed_cambio_XXXX.py

from sqlmodel import Session
from app.db import engine, init_db
from app.models.categoria_solicitud import CategoriaSolicitud

def seed_categorias():
    with Session(engine) as session:
        categorias = [
            CategoriaSolicitud(nombre="Papelería", descripcion="Suministros de oficina"),
            CategoriaSolicitud(nombre="Tecnología", descripcion="Equipos y software"),
            CategoriaSolicitud(nombre="Mantenimiento", descripcion="Servicios de mantenimiento"),
        ]
        for cat in categorias:
            session.add(cat)
        session.commit()
        print(f"✅ {len(categorias)} categorías creadas")

if __name__ == "__main__":
    init_db()
    seed_categorias()
```

### 2.4 CRUD

**¿Se modifica la lógica CRUD?**

- [ ] NO - Usar GenericCRUD estándar
- [ ] SÍ - Usar NestedCRUD
- [ ] SÍ - CRUD personalizado

**Si es personalizado, describir:**

```python
# Ejemplo: CRUD personalizado con validación

from app.core.generic_crud import GenericCRUD
from app.models.solicitud import Solicitud, PrioridadSolicitud

class SolicitudCRUD(GenericCRUD[Solicitud]):
    def create(self, session: Session, data: Dict[str, Any]) -> Solicitud:
        # Validación personalizada: solicitudes de tipo DIRECTA deben ser ALTA prioridad
        if data.get("tipo") == "directa" and data.get("prioridad") != PrioridadSolicitud.ALTA:
            raise ValueError("Solicitudes directas deben tener prioridad ALTA")
        
        return super().create(session, data)
```

### 2.5 Routers y Endpoints

#### 2.5.1 Endpoints Estándar

**¿Se usan endpoints genéricos?**

```python
# app/routers/solicitud_router.py

from app.core.router import create_generic_router
from app.models.solicitud import Solicitud

solicitud_crud = GenericCRUD(Solicitud)  # o SolicitudCRUD personalizado

solicitud_router = create_generic_router(
    model=Solicitud,
    crud=solicitud_crud,
    prefix="/solicitudes",
    tags=["solicitudes"],
)
```

#### 2.5.2 Endpoints Personalizados

**¿Se requieren endpoints adicionales?**

- [ ] NO
- [ ] SÍ - Describir a continuación

**Endpoints a crear:**

| Método | Ruta | Descripción | Request | Response |
|--------|------|-------------|---------|----------|
| `GET` | `/solicitudes/stats/by-priority` | Estadísticas por prioridad | - | `{"alta": 10, "media": 25, "baja": 5}` |
| `POST` | `/solicitudes/{id}/change-priority` | Cambiar prioridad | `{"prioridad": "alta"}` | `Solicitud` |

**Implementación:**

```python
# app/routers/solicitud_router.py (agregar al final)

@solicitud_router.get("/stats/by-priority")
def get_stats_by_priority(
    session: Session = Depends(get_session)
) -> Dict[str, int]:
    """Retorna cantidad de solicitudes por prioridad"""
    from sqlmodel import select, func
    
    result = session.exec(
        select(Solicitud.prioridad, func.count(Solicitud.id))
        .where(Solicitud.deleted_at.is_(None))
        .group_by(Solicitud.prioridad)
    ).all()
    
    return {prioridad: count for prioridad, count in result}
```

### 2.6 Servicios

**¿Se requieren servicios nuevos/modificados?**

- [ ] NO
- [ ] SÍ - Servicio nuevo
- [ ] SÍ - Modificar servicio existente

**Servicio a crear/modificar:**

```python
# Ejemplo:
# app/services/solicitud_notification_service.py

from typing import Dict, Any
from app.models.solicitud import Solicitud, PrioridadSolicitud

class SolicitudNotificationService:
    """Envía notificaciones según prioridad de solicitud"""
    
    def notify_on_create(self, solicitud: Solicitud) -> None:
        """Envía notificación al crear solicitud"""
        if solicitud.prioridad == PrioridadSolicitud.ALTA:
            self._send_urgent_notification(solicitud)
        else:
            self._send_normal_notification(solicitud)
    
    def _send_urgent_notification(self, solicitud: Solicitud) -> None:
        # Lógica para notificación urgente (email, SMS, etc.)
        pass
    
    def _send_normal_notification(self, solicitud: Solicitud) -> None:
        # Lógica para notificación normal
        pass
```

### 2.7 Validaciones

**Validaciones de negocio a implementar:**

```
[Completar aquí]
Ejemplo:
1. Campo 'prioridad' es obligatorio (default: "media")
2. Solo valores permitidos: "alta", "media", "baja"
3. No permitir cambiar prioridad si solicitud está aprobada
4. Solicitudes tipo DIRECTA solo pueden ser prioridad ALTA
```

### 2.8 Configuración

**¿Se requieren nuevas variables de entorno?**

```env
# .env (agregar si aplica)

# Ejemplo:
NOTIFICATION_ENABLED=1
URGENT_NOTIFICATION_EMAIL=compras-urgente@example.com
```

---

## 3. PLAN DE IMPLEMENTACIÓN

### 3.1 Orden de Ejecución

Seguir este orden secuencial:

```
1. Modelo de Datos
   ↓
2. Migración
   ↓
3. Seed Data (si aplica)
   ↓
4. CRUD (si requiere personalización)
   ↓
5. Servicios (si aplica)
   ↓
6. Routers y Endpoints
   ↓
7. Tests
   ↓
8. Verificación Local
   ↓
9. Deploy
```

### 3.2 Checklist Detallado

#### FASE 1: PREPARACIÓN

- [ ] **1.1** Leer README_BACKEND_v1.md secciones relevantes
- [ ] **1.2** Revisar modelos existentes relacionados
- [ ] **1.3** Identificar dependencias (otros modelos, servicios)
- [ ] **1.4** Crear branch de desarrollo: `git checkout -b feature/[nombre-cambio]`
- [ ] **1.5** Backup de base de datos local (si aplica)

#### FASE 2: MODELO DE DATOS

- [ ] **2.1** Crear/modificar modelo en `app/models/[entity].py`
  - [ ] Heredar de `Base`
  - [ ] Definir `__tablename__`
  - [ ] Configurar `__searchable_fields__`
  - [ ] Configurar `__expanded_list_relations__` (si aplica)
  - [ ] Definir campos con type hints correctos
  - [ ] Agregar validaciones con `Field()`
  - [ ] Definir relaciones con `Relationship()` (si aplica)
  - [ ] Agregar docstrings

**Comando de verificación:**

```bash
# Verificar que el modelo se importa sin errores
python -c "from app.models.[entity] import [Entity]; print('✅ Modelo OK')"
```

- [ ] **2.2** Verificar imports en `app/models/__init__.py`

```python
# app/models/__init__.py
from app.models.[entity] import [Entity]  # Agregar esta línea
```

#### FASE 3: MIGRACIÓN

- [ ] **3.1** Generar migración con Alembic

```bash
# Asegurarse de tener .env configurado
alembic revision --autogenerate -m "descripción_del_cambio"
```

- [ ] **3.2** Revisar script generado en `alembic/versions/`
  - [ ] Verificar que `upgrade()` es correcto
  - [ ] Verificar que `downgrade()` revierte cambios
  - [ ] Agregar `server_default` si el campo es NOT NULL
  - [ ] Agregar comentarios explicativos

- [ ] **3.3** Probar migración en local

```bash
# Aplicar migración
alembic upgrade head

# Verificar estado
alembic current

# Probar rollback
alembic downgrade -1

# Volver a aplicar
alembic upgrade head
```

- [ ] **3.4** Verificar estructura en base de datos

```bash
# Conectar a PostgreSQL y verificar
psql -d sak -c "\d [tabla]"
```

#### FASE 4: SEED DATA

- [ ] **4.1** Crear script de seed (si aplica) en `scripts/seed_[nombre].py`
  - [ ] Importar modelos necesarios
  - [ ] Crear función `seed_[entidad]()`
  - [ ] Agregar manejo de errores
  - [ ] Agregar mensajes de confirmación

- [ ] **4.2** Ejecutar seed en local

```bash
python scripts/seed_[nombre].py
```

- [ ] **4.3** Verificar datos en base de datos

```bash
psql -d sak -c "SELECT * FROM [tabla] LIMIT 10;"
```

#### FASE 5: CRUD

- [ ] **5.1** Decidir tipo de CRUD
  - [ ] `GenericCRUD` estándar → No requiere código adicional
  - [ ] `NestedCRUD` → Configurar relaciones anidadas
  - [ ] CRUD personalizado → Crear clase en `app/crud/`

- [ ] **5.2** Implementar CRUD (si es personalizado)

```python
# app/crud/[entity]_crud.py
from app.core.generic_crud import GenericCRUD
from app.models.[entity] import [Entity]

class [Entity]CRUD(GenericCRUD[[Entity]]):
    def create(self, session: Session, data: Dict[str, Any]) -> [Entity]:
        # Validaciones personalizadas
        # ...
        return super().create(session, data)
```

- [ ] **5.3** Verificar que CRUD se instancia correctamente

```bash
python -c "from app.crud.[entity]_crud import [Entity]CRUD; print('✅ CRUD OK')"
```

#### FASE 6: SERVICIOS

- [ ] **6.1** Crear servicio (si aplica) en `app/services/[entity]_service.py`
  - [ ] Naming: `[Entity]Service`
  - [ ] Métodos con docstrings
  - [ ] Manejo de errores
  - [ ] Logging (si aplica)

- [ ] **6.2** Verificar imports

```bash
python -c "from app.services.[entity]_service import [Entity]Service; print('✅ Servicio OK')"
```

#### FASE 7: ROUTERS

- [ ] **7.1** Crear/modificar router en `app/routers/[entity]_router.py`

```python
from app.models.[entity] import [Entity]
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

[entity]_crud = GenericCRUD([Entity])

[entity]_router = create_generic_router(
    model=[Entity],
    crud=[entity]_crud,
    prefix="/[entities]",
    tags=["[entities]"],
)
```

- [ ] **7.2** Agregar endpoints personalizados (si aplica)

```python
@[entity]_router.get("/custom-endpoint")
def custom_endpoint(...):
    pass
```

- [ ] **7.3** Registrar router en `app/main.py`

```python
from app.routers.[entity]_router import [entity]_router
app.include_router([entity]_router)
```

- [ ] **7.4** Verificar que la app arranca sin errores

```bash
uvicorn app.main:app --reload --port 8000
# Verificar consola sin errores
```

- [ ] **7.5** Verificar Swagger UI

```
# Abrir en navegador
http://localhost:8000/docs

# Verificar que aparecen los endpoints nuevos/modificados
```

#### FASE 8: TESTS

- [ ] **8.1** Tests de Modelo

```python
# tests/test_[entity]_model.py
def test_crear_[entity]():
    """Test crear [entity] con validaciones"""
    obj = [Entity](campo1="valor1", campo2="valor2")
    assert obj.campo1 == "valor1"
```

- [ ] **8.2** Tests de CRUD

```python
# tests/test_[entity]_crud.py
def test_crud_create(session):
    """Test crear con CRUD"""
    crud = GenericCRUD([Entity])
    data = {"campo1": "valor1"}
    obj = crud.create(session, data)
    assert obj.id is not None

def test_crud_list_with_filters(session):
    """Test listar con filtros"""
    # ...
```

- [ ] **8.3** Tests de Endpoints

```python
# tests/test_[entity]_router.py
def test_create_endpoint(client):
    """Test POST /[entities]"""
    response = client.post("/[entities]", json={...})
    assert response.status_code == 201

def test_list_endpoint(client):
    """Test GET /[entities]"""
    response = client.get("/[entities]?range=[0,9]")
    assert response.status_code == 200
    assert "X-Total-Count" in response.headers
```

- [ ] **8.4** Tests de Servicios (si aplica)

```python
# tests/test_[entity]_service.py
def test_service_method():
    """Test método del servicio"""
    # ...
```

- [ ] **8.5** Ejecutar todos los tests

```bash
# Todos los tests
pytest -v

# Solo tests del cambio
pytest tests/test_[entity]* -v

# Con coverage
pytest --cov=app --cov-report=html
```

- [ ] **8.6** Verificar coverage mínimo (>80% en archivos nuevos)

#### FASE 9: VERIFICACIÓN LOCAL

- [ ] **9.1** Iniciar servidor local

```bash
uvicorn app.main:app --reload --port 8000
```

- [ ] **9.2** Verificar Swagger UI: http://localhost:8000/docs
  - [ ] Endpoints aparecen en la lista
  - [ ] Schemas son correctos
  - [ ] Ejemplos son claros

- [ ] **9.3** Probar casos de uso manualmente

**Caso 1: Crear entidad**

```bash
curl -X POST http://localhost:8000/[entities] \
  -H "Content-Type: application/json" \
  -d '{"campo1": "valor1", "campo2": "valor2"}'

# Verificar respuesta:
# - Status 201
# - Objeto con id generado
# - Campos correctos
```

**Caso 2: Listar entidades**

```bash
curl http://localhost:8000/[entities]?range=[0,9]

# Verificar:
# - Status 200
# - Header X-Total-Count presente
# - Array de objetos
```

**Caso 3: Obtener por ID**

```bash
curl http://localhost:8000/[entities]/1

# Verificar:
# - Status 200
# - Objeto completo con relaciones expandidas (si aplica)
```

**Caso 4: Actualizar**

```bash
curl -X PUT http://localhost:8000/[entities]/1 \
  -H "Content-Type: application/json" \
  -d '{"campo1": "nuevo_valor"}'

# Verificar:
# - Status 200
# - Campos actualizados
```

**Caso 5: Eliminar (soft delete)**

```bash
curl -X DELETE http://localhost:8000/[entities]/1

# Verificar:
# - Status 200
# - Listar con deleted=include muestra el objeto
# - deleted_at tiene timestamp
```

- [ ] **9.4** Verificar en base de datos

```bash
psql -d sak

# Verificar registros creados
SELECT * FROM [tabla] ORDER BY id DESC LIMIT 5;

# Verificar soft delete
SELECT id, deleted_at FROM [tabla] WHERE deleted_at IS NOT NULL;
```

- [ ] **9.5** Probar casos de error
  - [ ] Campo obligatorio faltante → 400/422
  - [ ] ID inexistente → 404
  - [ ] Validación personalizada falla → 400
  - [ ] Tipo de dato incorrecto → 422

#### FASE 10: DOCUMENTACIÓN

- [ ] **10.1** Actualizar docstrings en código
- [ ] **10.2** Agregar comentarios en lógica compleja
- [ ] **10.3** Actualizar README_BACKEND si aplica (nuevos patrones)
- [ ] **10.4** Documentar en este archivo SPEC (sección 6: Resultados)

#### FASE 11: COMMIT Y PUSH

- [ ] **11.1** Revisar cambios

```bash
git status
git diff
```

- [ ] **11.2** Commit con mensaje descriptivo

```bash
git add .
git commit -m "feat: [descripción del cambio]

- Agregar campo X al modelo Y
- Crear migración ZZZZ
- Implementar endpoints personalizados
- Agregar tests (coverage >80%)

Ref: CHG-2024-XXX"
```

- [ ] **11.3** Push a repositorio

```bash
git push origin feature/[nombre-cambio]
```

#### FASE 12: DEPLOY A STAGING/PRODUCCIÓN

- [ ] **12.1** Crear Pull Request
  - [ ] Título descriptivo
  - [ ] Descripción con contexto
  - [ ] Link a esta especificación
  - [ ] Screenshots/ejemplos (si aplica)

- [ ] **12.2** Code Review
  - [ ] Al menos 1 aprobación
  - [ ] Resolver comentarios

- [ ] **12.3** Merge a master

```bash
git checkout master
git pull origin master
git merge feature/[nombre-cambio]
git push origin master
```

- [ ] **12.4** Deploy automático (GitHub Actions)
  - [ ] Verificar workflow en GitHub Actions
  - [ ] Esperar despliegue exitoso a Cloud Run

- [ ] **12.5** Aplicar migraciones en producción

```bash
# Usar URL directa de Neon (sin pooler)
alembic upgrade head --url "postgresql://user:pass@ep-XXX.neon.tech/sak?sslmode=require"
```

- [ ] **12.6** Ejecutar seed en producción (si aplica)

```bash
# Conectar a producción y ejecutar script
# O usar un endpoint admin para seed
```

- [ ] **12.7** Verificar en producción
  - [ ] Health check: `curl https://[backend-url]/health`
  - [ ] Swagger: `https://[backend-url]/docs`
  - [ ] Test manual de endpoints críticos

- [ ] **12.8** Monitoreo post-deploy
  - [ ] Verificar logs en Cloud Run (primeros 15 minutos)
  - [ ] Verificar errores en Sentry (si está configurado)
  - [ ] Verificar métricas de performance

#### FASE 13: COMUNICACIÓN

- [ ] **13.1** Notificar a equipo de desarrollo
- [ ] **13.2** Notificar a frontend (si requiere cambios)
- [ ] **13.3** Actualizar documentación de API (si aplica)
- [ ] **13.4** Actualizar estado del cambio a "Completado"

---

## 4. CASOS DE PRUEBA

### 4.1 Casos de Éxito

| ID | Descripción | Request | Expected Response | Status |
|----|-------------|---------|-------------------|--------|
| TC-001 | Crear entidad con datos válidos | `POST /[entities]` con payload válido | `201 Created` + objeto con id | `[ ]` |
| TC-002 | Listar todas las entidades | `GET /[entities]?range=[0,24]` | `200 OK` + array + header X-Total-Count | `[ ]` |
| TC-003 | Obtener entidad por ID | `GET /[entities]/1` | `200 OK` + objeto completo | `[ ]` |
| TC-004 | Actualizar entidad | `PUT /[entities]/1` con payload | `200 OK` + objeto actualizado | `[ ]` |
| TC-005 | Eliminar entidad (soft) | `DELETE /[entities]/1` | `200 OK` + objeto con deleted_at | `[ ]` |

### 4.2 Casos de Error

| ID | Descripción | Request | Expected Response | Status |
|----|-------------|---------|-------------------|--------|
| TC-E001 | Crear con campo obligatorio faltante | `POST /[entities]` sin campo requerido | `422 Unprocessable Entity` | `[ ]` |
| TC-E002 | Obtener ID inexistente | `GET /[entities]/99999` | `404 Not Found` | `[ ]` |
| TC-E003 | Actualizar con tipo de dato incorrecto | `PUT /[entities]/1` con tipo inválido | `422 Unprocessable Entity` | `[ ]` |
| TC-E004 | Crear con valor fuera de rango | `POST /[entities]` con valor inválido | `400 Bad Request` | `[ ]` |

### 4.3 Casos de Negocio

| ID | Descripción | Precondiciones | Pasos | Expected Result | Status |
|----|-------------|----------------|-------|-----------------|--------|
| TC-B001 | `[Describir caso]` | `[Condiciones]` | 1. ... 2. ... | `[Resultado]` | `[ ]` |

**Ejemplo:**

| ID | Descripción | Precondiciones | Pasos | Expected Result | Status |
|----|-------------|----------------|-------|-----------------|--------|
| TC-B001 | Solicitud directa debe ser prioridad alta | Usuario autenticado | 1. POST /solicitudes con tipo="directa" y prioridad="baja" | 400 Bad Request con mensaje "Solicitudes directas deben tener prioridad ALTA" | `[ ]` |

### 4.4 Casos de Integración

| ID | Descripción | Expected Behavior | Status |
|----|-------------|-------------------|--------|
| TC-I001 | Crear entidad con relación (FK) | Debe validar que FK existe | `[ ]` |
| TC-I002 | Eliminar entidad con dependientes | Debe hacer cascade o lanzar error | `[ ]` |

---

## 5. ROLLBACK PLAN

### 5.1 Si falla en Testing

```bash
# Revertir migración
alembic downgrade -1

# Eliminar branch
git branch -D feature/[nombre-cambio]
```

### 5.2 Si falla en Producción

**Opción A: Rollback de migración**

```bash
# Conectar a prod
alembic downgrade -1 --url "postgresql://..."

# Verificar estado
alembic current --url "postgresql://..."
```

**Opción B: Revertir deploy**

```bash
# Revertir commit en master
git revert [commit-hash]
git push origin master

# GitHub Actions despliega versión anterior automáticamente
```

**Opción C: Rollback manual en Cloud Run**

1. Ir a Google Cloud Console
2. Cloud Run → sak-backend
3. Pestaña "Revisiones"
4. Seleccionar revisión anterior
5. "Administrar tráfico" → 100% a revisión anterior

---

## 6. RESULTADOS

### 6.1 Cambios Implementados

**Resumen:**

```
[Completar DESPUÉS de implementar]

Ejemplo:
- ✅ Agregado campo 'prioridad' a modelo Solicitud
- ✅ Creada migración 0010_add_prioridad_to_solicitudes.py
- ✅ Agregado enum PrioridadSolicitud (ALTA, MEDIA, BAJA)
- ✅ Implementada validación: solicitudes directas = prioridad alta
- ✅ Agregado endpoint GET /solicitudes/stats/by-priority
- ✅ Tests: 15 casos, coverage 85%
```

### 6.2 Archivos Modificados/Creados

```
[Completar DESPUÉS de implementar]

Ejemplo:
MODIFICADOS:
- app/models/solicitud.py (+15 líneas)
- app/routers/solicitud_router.py (+30 líneas)

CREADOS:
- alembic/versions/0010_add_prioridad_to_solicitudes.py (45 líneas)
- tests/test_solicitud_prioridad.py (80 líneas)

TOTAL: 4 archivos, +170 líneas
```

### 6.3 Métricas

| Métrica | Valor |
|---------|-------|
| **Tiempo estimado** | `[X horas]` |
| **Tiempo real** | `[Y horas]` |
| **Tests escritos** | `[N tests]` |
| **Coverage** | `[X%]` |
| **Líneas agregadas** | `[+X]` |
| **Líneas eliminadas** | `[-Y]` |

### 6.4 Lecciones Aprendidas

```
[Completar DESPUÉS de implementar]

Ejemplo:
- La validación personalizada en CRUD es preferible a hacerla en router
- Los enums deben definirse en el mismo archivo del modelo para evitar imports circulares
- Siempre probar rollback de migración antes de aplicar en prod
```

---

## 7. REFERENCIAS

### 7.1 Documentación

- [README_BACKEND_v1.md](../../README_BACKEND_v1.md) - Arquitectura y patrones
- [Alembic Migrations](https://alembic.sqlalchemy.org/)
- [FastAPI Best Practices](https://fastapi.tiangolo.com/tutorial/)
- [SQLModel Documentation](https://sqlmodel.tiangolo.com/)

### 7.2 Código Relacionado

```
[Links a archivos relevantes]

Ejemplo:
- app/models/solicitud.py (modelo base)
- app/routers/solicitud_router.py (router existente)
- app/core/generic_crud.py (patrón CRUD)
```

### 7.3 Issues/Tickets

```
[Links a issues, tickets de Jira, etc.]

Ejemplo:
- GitHub Issue #123: "Agregar prioridad a solicitudes"
- Jira SAK-456: "Funcionalidad de priorización"
```

---

## 8. APROBACIONES

| Rol | Nombre | Fecha | Firma/Aprobación |
|-----|--------|-------|------------------|
| **Desarrollador** | `[Nombre]` | `[Fecha]` | `[ ] Aprobado` |
| **Tech Lead** | `[Nombre]` | `[Fecha]` | `[ ] Aprobado` |
| **Product Owner** | `[Nombre]` | `[Fecha]` | `[ ] Aprobado` |

---

## 📌 NOTAS FINALES

### Convenciones de Commit

```bash
# Formato de commits
feat: [descripción]        # Nueva funcionalidad
fix: [descripción]         # Corrección de bug
refactor: [descripción]    # Refactorización
test: [descripción]        # Agregar tests
docs: [descripción]        # Documentación
chore: [descripción]       # Tareas de mantenimiento

# Ejemplo completo:
git commit -m "feat: add prioridad field to solicitudes

- Add PrioridadSolicitud enum (ALTA, MEDIA, BAJA)
- Add prioridad field to Solicitud model (default: MEDIA)
- Create migration 0010_add_prioridad_to_solicitudes
- Add validation: direct solicitudes must be HIGH priority
- Add endpoint GET /solicitudes/stats/by-priority
- Add 15 test cases (coverage 85%)

Ref: CHG-2024-001"
```

### Comandos Útiles

```bash
# Desarrollo
uvicorn app.main:app --reload --port 8000

# Migraciones
alembic revision --autogenerate -m "mensaje"
alembic upgrade head
alembic downgrade -1
alembic current
alembic history --verbose | tail -20

# Testing
pytest -v
pytest tests/test_[entity]* -v
pytest --cov=app --cov-report=html

# Base de datos
psql -d sak
\dt                  # Listar tablas
\d [tabla]           # Estructura de tabla
SELECT * FROM [tabla] LIMIT 10;

# Git
git status
git diff
git log --oneline -10
```

---

**FIN DEL TEMPLATE**

*Recuerda: Este template es una guía. Adapta según la complejidad del cambio.*
