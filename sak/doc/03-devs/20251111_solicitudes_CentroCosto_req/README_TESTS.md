# 🧪 Tests de Centro de Costo

Suite completa de tests para la implementación de Centro de Costo en el sistema.

## 📁 Archivos de Tests

### 1. `test_centro_costo_models.py`
Tests unitarios del modelo `CentroCosto`.

**Cobertura:**
- ✅ Creación de centros de costo (General, Proyecto, Propiedad)
- ✅ Validación de campo `nombre` único
- ✅ Validación de campo `codigo_contable` no único (puede repetirse)
- ✅ Campo `activo` (soft delete)
- ✅ Campo `descripcion` opcional
- ✅ Representación en string

**Ejecución:**
```bash
pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_centro_costo_models.py -v
```

---

### 2. `test_centro_costo_endpoints.py`
Tests de integración de endpoints REST de CentroCosto.

**Cobertura:**
- ✅ GET `/api/centros-costo` - Listar todos
- ✅ GET `/api/centros-costo/{id}` - Obtener por ID
- ✅ POST `/api/centros-costo` - Crear nuevo
- ✅ PUT `/api/centros-costo/{id}` - Actualizar
- ✅ DELETE `/api/centros-costo/{id}` - Soft delete
- ✅ Filtros por `tipo`, `activo`
- ✅ Búsqueda con parámetro `q`
- ✅ Paginación con `range`
- ✅ Validación de nombre duplicado (debe fallar)
- ✅ Validación de codigo_contable duplicado (debe permitir)

**Requisitos:**
⚠️ **Servidor debe estar corriendo en `http://localhost:8000`**

**Ejecución:**
```bash
# Iniciar servidor
cd backend
uvicorn app.main:app --reload --port 8000

# En otra terminal
pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_centro_costo_endpoints.py -v
```

---

### 3. `test_solicitud_centro_costo.py`
Tests de integración de Solicitud con Centro de Costo.

**Cobertura:**
- ✅ Crear solicitud con `centro_costo_id`
- ✅ Crear solicitud sin `centro_costo_id` (debe fallar)
- ✅ Obtener solicitud con `centro_costo` expandido
- ✅ Actualizar solicitud cambiando centro de costo
- ✅ Filtrar solicitudes por `centro_costo_id`

**Requisitos:**
⚠️ **Servidor debe estar corriendo en `http://localhost:8000`**

**Ejecución:**
```bash
# Iniciar servidor
cd backend
uvicorn app.main:app --reload --port 8000

# En otra terminal
pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_solicitud_centro_costo.py -v
```

---

### 4. `test_solicitud_detalle_precio.py`
Tests del modelo `SolicitudDetalle` con campos `precio` e `importe`.

**Cobertura:**
- ✅ Campos `precio` e `importe` existen
- ✅ Valores por defecto (0)
- ✅ Cálculo de importe en frontend
- ✅ Precisión DECIMAL(15,2)
- ✅ Manejo de valores en cero
- ✅ Manejo de cantidades grandes
- ✅ Cálculo de total con múltiples detalles

**Ejecución:**
```bash
pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_solicitud_detalle_precio.py -v
```

---

## 🚀 Ejecutar Todos los Tests

### Opción 1: Script Maestro
```bash
python doc/03-devs/20251111_solicitudes_CentroCosto_req/run_all_tests.py
```

Este script ejecuta todos los tests en secuencia y muestra un resumen final.

### Opción 2: pytest directamente
```bash
# Tests que NO requieren servidor
pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_centro_costo_models.py -v
pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_solicitud_detalle_precio.py -v

# Tests que SÍ requieren servidor (iniciar servidor primero)
pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_centro_costo_endpoints.py -v
pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_solicitud_centro_costo.py -v
```

### Opción 3: Ejecutar todos con pytest
```bash
pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_*.py -v
```

---

## 📊 Cobertura de Tests

| Categoría | Tests | Descripción |
|-----------|-------|-------------|
| **Modelos** | 8 | Tests unitarios de CentroCosto y SolicitudDetalle |
| **Endpoints** | 14 | Tests de API REST de CentroCosto |
| **Integración** | 5 | Tests de Solicitud con CentroCosto |
| **TOTAL** | **27** | Suite completa de tests |

---

## 🛠️ Requisitos

### Dependencias Python
```bash
pip install pytest requests sqlmodel
```

### Base de Datos
Los tests de modelos usan SQLite en memoria (no requieren configuración).

Los tests de endpoints requieren:
- ✅ Base de datos PostgreSQL configurada
- ✅ Migraciones aplicadas (`alembic upgrade head`)
- ✅ Datos seed básicos (departamentos, tipos_solicitud, users)
- ✅ Servidor backend corriendo en `http://localhost:8000`

---

## ⚠️ Notas Importantes

### Tests de Endpoints
Los tests de endpoints crean y eliminan datos temporales. Usa fixtures con cleanup automático para evitar datos basura.

### Tests de Integración
Algunos tests pueden fallar con `422 Unprocessable Entity` si faltan datos requeridos en la base de datos (departamentos, tipos_solicitud, users). En ese caso, el test se marca como `skipped`.

### Servidor Local
Para tests de endpoints, asegúrate de que:
1. El servidor esté corriendo: `uvicorn app.main:app --reload --port 8000`
2. La base de datos esté accesible
3. Las migraciones estén aplicadas

---

## 🐛 Debugging

### Ver salida detallada
```bash
pytest <test_file> -v -s
```

### Ver solo errores
```bash
pytest <test_file> --tb=short
```

### Ejecutar un test específico
```bash
pytest <test_file>::test_function_name -v
```

### Ejemplo:
```bash
pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_centro_costo_models.py::test_create_centro_costo_general -v
```

---

## 📝 Mantenimiento

Al agregar nuevas funcionalidades:

1. **Agregar tests en el archivo correspondiente**
2. **Ejecutar suite completa para verificar regresiones**
3. **Actualizar este README si es necesario**

---

## ✅ Checklist de Validación

Antes de hacer commit:

- [ ] Todos los tests de modelos pasan
- [ ] Todos los tests de endpoints pasan (con servidor corriendo)
- [ ] Todos los tests de integración pasan
- [ ] No hay warnings de Pylance en los archivos de test
- [ ] Cobertura de código > 80% para nuevas funcionalidades

---

**Última actualización:** 2025-11-12  
**Autor:** Sistema SAK - Gestión de Solicitudes
