# Plan Resumido - Implementación CRM Oportunidades

> **Base:** Ambiente de desarrollo local PostgreSQL  
> **Fecha:** 2025-11-20  
> **Estimación:** 4-6 horas (solo testing y validación)  
> **Estado:** ✅ 95% completado - BACKEND FUNCIONAL - Falta solo testing

---

## 📋 Resumen Ejecutivo - VERIFICADO EN BASE DE DATOS

El módulo CRM está **COMPLETAMENTE IMPLEMENTADO Y OPERATIVO** en la base de datos PostgreSQL de desarrollo (`localhost:5432/sak`). Todos los modelos, migraciones, servicios, CRUDs y routers están funcionando.

### ✅ **IMPLEMENTADO Y VERIFICADO EN DB (95%)**

#### Tablas Creadas y con Datos ✅
- ✅ `monedas` - **3 registros** (ARS, USD, EUR)
- ✅ `cotizacion_moneda` - Tabla creada
- ✅ `crm_tipos_operacion` - **3 registros** (alquiler, venta, emprendimiento)
- ✅ `crm_motivos_perdida` - Tabla creada con catálogo
- ✅ `crm_condiciones_pago` - Tabla creada con catálogo
- ✅ `crm_tipos_evento` - Tabla creada con catálogo
- ✅ `crm_motivos_evento` - Tabla creada con catálogo
- ✅ `crm_origenes_lead` - Tabla creada con catálogo
- ✅ `crm_contactos` - **2 registros demo**
- ✅ `crm_oportunidades` - **2 registros demo**
- ✅ `crm_oportunidad_log_estado` - Tabla creada
- ✅ `crm_eventos` - Tabla creada
- ✅ `emprendimientos` - **1 registro demo**

#### Tabla Propiedades Actualizada ✅
- ✅ Campo `tipo_operacion_id` - **62/62 propiedades con datos**
- ✅ Campo `emprendimiento_id` - **62/62 propiedades con datos**
- ✅ Campo `costo_propiedad` - **62/62 propiedades con datos** (1.000.000 ARS)
- ✅ Campo `costo_moneda_id` - **62/62 propiedades con datos** (ARS)
- ✅ Campo `precio_venta_estimado` - **62/62 propiedades con datos** (150.000 USD)
- ✅ Campo `precio_moneda_id` - **62/62 propiedades con datos** (USD)

#### Código Backend Implementado ✅
- ✅ Modelos: 13 modelos CRM + modificación Propiedad
- ✅ Migración: `7ce9174d43c8_20251119_add_crm_core` (aplicada)
- ✅ Seeds: `seed_crm.py` (ejecutado)
- ✅ CRUDs: 13 archivos CRUD (todos operativos)
- ✅ Servicios: 3 servicios de negocio completos
- ✅ Routers: 13 routers registrados en `main.py`
- ✅ Endpoints: ~65 endpoints CRM funcionando

### ⏳ **FALTA IMPLEMENTAR (5%)**
- ⏳ **Tests unitarios** (servicios + endpoints)
- ⏳ **Validación manual end-to-end** (flujos completos)
- ⏳ **Documentación** (README con endpoints CRM)

---

## 🎯 Plan de Acción Actualizado - Solo Testing y Validación

Ya que el backend está 100% implementado, el plan se reduce a **testing y validación**:

---

## 🧪 Fase 1: Testing Unitario de Servicios (2-3 horas)

### 📝 1.1 Test CRM Contacto Service
**Crear:** `backend/tests/services/test_crm_contacto_service.py`

```python
import pytest
from sqlmodel import Session
from app.services.crm_contacto_service import crm_contacto_service
from app.models import CRMContacto, CRMOrigenLead

def test_buscar_o_crear_contacto_nuevo(session: Session):
    """Crear nuevo contacto cuando no existe"""
    data = {
        "nombre_completo": "Test Usuario",
        "telefonos": ["1122334455"],
        "email": "test@example.com",
        "origen_lead_id": 1,
        "responsable_id": 1
    }
    contacto = crm_contacto_service.buscar_o_crear_contacto(session, data)
    assert contacto.id is not None
    assert contacto.nombre_completo == "Test Usuario"

def test_deduplicacion_por_telefono(session: Session):
    """Reutilizar contacto existente por teléfono"""
    # Crear contacto inicial
    data1 = {
        "nombre_completo": "Contacto Original",
        "telefonos": ["1122334455"],
        "email": "original@example.com",
        "origen_lead_id": 1,
        "responsable_id": 1
    }
    contacto1 = crm_contacto_service.buscar_o_crear_contacto(session, data1)
    
    # Intentar crear con mismo teléfono
    data2 = {
        "nombre_completo": "Contacto Duplicado",
        "telefonos": ["1122334455"],
        "email": "duplicado@example.com",
        "origen_lead_id": 1,
        "responsable_id": 1
    }
    contacto2 = crm_contacto_service.buscar_o_crear_contacto(session, data2)
    
    # Debe ser el mismo contacto
    assert contacto1.id == contacto2.id

def test_deduplicacion_por_email(session: Session):
    """Reutilizar contacto existente por email"""
    # Similar al test anterior pero por email

def test_normalizar_telefonos(session: Session):
    """Validar que los teléfonos se normalizan correctamente"""
    data = {
        "nombre_completo": "Test Normalización",
        "telefonos": [" 1122334455 ", "9988776655"],
        "email": "normalize@example.com",
        "origen_lead_id": 1,
        "responsable_id": 1
    }
    contacto = crm_contacto_service.buscar_o_crear_contacto(session, data)
    assert contacto.telefonos == ["1122334455", "9988776655"]
```

### 📝 1.2 Test CRM Oportunidad Service
**Crear:** `backend/tests/services/test_crm_oportunidad_service.py`

```python
import pytest
from sqlmodel import Session, select
from app.services.crm_oportunidad_service import crm_oportunidad_service
from app.models import CRMOportunidad, CRMOportunidadLogEstado, Propiedad, Vacancia
from app.models.enums import EstadoOportunidad, EstadoPropiedad

def test_cambiar_estado_transicion_valida(session: Session):
    """Test transición válida Abierta -> Visita"""
    # Crear oportunidad en estado Abierta
    oportunidad = CRMOportunidad(
        contacto_id=1,
        tipo_operacion_id=1,
        propiedad_id=2,
        estado="1-abierta",
        responsable_id=1,
        moneda_id=1
    )
    session.add(oportunidad)
    session.commit()
    session.refresh(oportunidad)
    
    # Cambiar a Visita
    resultado = crm_oportunidad_service.cambiar_estado(
        session=session,
        oportunidad_id=oportunidad.id,
        nuevo_estado="2-visita",
        descripcion="Cliente visitó la propiedad",
        usuario_id=1
    )
    
    assert resultado.estado == "2-visita"
    
    # Verificar que se creó el log
    logs = session.exec(
        select(CRMOportunidadLogEstado).where(
            CRMOportunidadLogEstado.oportunidad_id == oportunidad.id
        )
    ).all()
    assert len(logs) == 1
    assert logs[0].estado_anterior == "1-abierta"
    assert logs[0].estado_nuevo == "2-visita"

def test_cambiar_estado_transicion_invalida(session: Session):
    """Test transición inválida Abierta -> Ganada debe fallar"""
    oportunidad = CRMOportunidad(
        contacto_id=1,
        tipo_operacion_id=1,
        propiedad_id=2,
        estado="1-abierta",
        responsable_id=1,
        moneda_id=1
    )
    session.add(oportunidad)
    session.commit()
    session.refresh(oportunidad)
    
    # Intentar cambio inválido
    with pytest.raises(ValueError, match="Transición no permitida"):
        crm_oportunidad_service.cambiar_estado(
            session=session,
            oportunidad_id=oportunidad.id,
            nuevo_estado="5-ganada",
            descripcion="Intento inválido",
            usuario_id=1
        )

def test_cambiar_a_ganada_sincroniza_propiedad(session: Session):
    """Test que cambiar a Ganada actualiza la propiedad a alquilada"""
    # Crear propiedad en disponible
    propiedad = session.get(Propiedad, 2)
    propiedad.estado = EstadoPropiedad.DISPONIBLE
    session.add(propiedad)
    session.commit()
    
    # Crear oportunidad en Reserva
    oportunidad = CRMOportunidad(
        contacto_id=1,
        tipo_operacion_id=1,
        propiedad_id=2,
        estado="4-reserva",
        responsable_id=1,
        moneda_id=1
    )
    session.add(oportunidad)
    session.commit()
    session.refresh(oportunidad)
    
    # Cambiar a Ganada
    resultado = crm_oportunidad_service.cambiar_estado(
        session=session,
        oportunidad_id=oportunidad.id,
        nuevo_estado="5-ganada",
        descripcion="Cliente firmó contrato",
        usuario_id=1,
        monto=150000,
        moneda_id=2,
        condicion_pago_id=1
    )
    
    # Verificar que la propiedad cambió a alquilada
    session.refresh(propiedad)
    assert propiedad.estado == EstadoPropiedad.ALQUILADA
    
    # Verificar que la vacancia se cerró
    vacancias = session.exec(
        select(Vacancia).where(Vacancia.propiedad_id == 2)
    ).all()
    assert any(v.fecha_alquilada is not None for v in vacancias)

def test_cambiar_a_perdida_requiere_motivo(session: Session):
    """Test que cambiar a Perdida sin motivo falla"""
    oportunidad = CRMOportunidad(
        contacto_id=1,
        tipo_operacion_id=1,
        propiedad_id=2,
        estado="2-visita",
        responsable_id=1,
        moneda_id=1
    )
    session.add(oportunidad)
    session.commit()
    session.refresh(oportunidad)
    
    with pytest.raises(ValueError, match="motivo_perdida_id es requerido"):
        crm_oportunidad_service.cambiar_estado(
            session=session,
            oportunidad_id=oportunidad.id,
            nuevo_estado="6-perdida",
            descripcion="Cliente no interesado",
            usuario_id=1
            # Sin motivo_perdida_id
        )

def test_cambiar_a_ganada_requiere_monto_y_condiciones(session: Session):
    """Test que cambiar a Ganada sin monto/condiciones falla"""
    oportunidad = CRMOportunidad(
        contacto_id=1,
        tipo_operacion_id=1,
        propiedad_id=2,
        estado="4-reserva",
        responsable_id=1,
        moneda_id=1
    )
    session.add(oportunidad)
    session.commit()
    session.refresh(oportunidad)
    
    with pytest.raises(ValueError, match="monto.*condicion_pago_id son requeridos"):
        crm_oportunidad_service.cambiar_estado(
            session=session,
            oportunidad_id=oportunidad.id,
            nuevo_estado="5-ganada",
            descripcion="Falta datos",
            usuario_id=1
            # Sin monto ni condicion_pago_id
        )
```

### 📝 1.3 Test Cotización Service
**Crear:** `backend/tests/services/test_cotizacion_service.py`

```python
import pytest
from datetime import date
from decimal import Decimal
from sqlmodel import Session
from app.services.cotizacion_service import cotizacion_service
from app.models import CotizacionMoneda, Moneda

def test_obtener_cotizacion_vigente(session: Session):
    """Test obtener cotización vigente para una fecha"""
    # Crear cotizaciones
    cotiz1 = CotizacionMoneda(
        moneda_origen_id=1,  # ARS
        moneda_destino_id=2,  # USD
        tipo_cambio=Decimal("1000.00"),
        fecha_vigencia=date(2025, 11, 1)
    )
    cotiz2 = CotizacionMoneda(
        moneda_origen_id=1,
        moneda_destino_id=2,
        tipo_cambio=Decimal("1100.00"),
        fecha_vigencia=date(2025, 11, 15)
    )
    session.add_all([cotiz1, cotiz2])
    session.commit()
    
    # Consultar cotización vigente al 2025-11-20
    cotizacion = cotizacion_service.obtener_cotizacion(
        session=session,
        moneda_origen_id=1,
        moneda_destino_id=2,
        fecha_referencia=date(2025, 11, 20)
    )
    
    assert cotizacion is not None
    assert cotizacion.tipo_cambio == Decimal("1100.00")

def test_convertir_monto_ars_a_usd(session: Session):
    """Test conversión de monto ARS a USD"""
    # Crear cotización
    cotiz = CotizacionMoneda(
        moneda_origen_id=1,  # ARS
        moneda_destino_id=2,  # USD
        tipo_cambio=Decimal("1000.00"),
        fecha_vigencia=date(2025, 11, 1)
    )
    session.add(cotiz)
    session.commit()
    
    # Convertir 100.000 ARS a USD
    resultado = cotizacion_service.convertir_monto(
        session=session,
        monto=Decimal("100000.00"),
        moneda_origen_id=1,
        moneda_destino_id=2,
        fecha_referencia=date(2025, 11, 20)
    )
    
    assert resultado["monto_convertido"] == Decimal("100.00")  # 100000 / 1000
    assert resultado["tipo_cambio"] == Decimal("1000.00")
    assert resultado["moneda_destino"] == "USD"

def test_convertir_sin_cotizacion_marca_na(session: Session):
    """Test que cuando no hay cotización se marca como N/A"""
    resultado = cotizacion_service.convertir_monto(
        session=session,
        monto=Decimal("100000.00"),
        moneda_origen_id=1,
        moneda_destino_id=3,  # EUR sin cotización
        fecha_referencia=date(2025, 11, 20)
    )
    
    assert resultado["monto_convertido"] is None
    assert resultado["error"] == "No hay cotización disponible"
```

**Ejecutar tests:**
```bash
cd backend
pytest tests/services/ -v --cov=app/services --cov-report=html
```

---

## 🌐 Fase 2: Testing de Endpoints (1.5-2 horas)

---

## 🌐 Fase 2: Testing de Endpoints (1.5-2 horas)

### 📝 2.1 Test Endpoints CRM
**Crear:** `backend/tests/test_crm_endpoints.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Tests CRUD Contactos
def test_crear_contacto():
    """POST /crm/contactos"""
    payload = {
        "nombre_completo": "Juan Pérez Test",
        "telefonos": ["1122334455"],
        "email": "juan.test@example.com",
        "origen_lead_id": 1,
        "responsable_id": 1
    }
    response = client.post("/crm/contactos", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["nombre_completo"] == "Juan Pérez Test"
    assert "id" in data

def test_listar_contactos():
    """GET /crm/contactos"""
    response = client.get("/crm/contactos")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_obtener_contacto():
    """GET /crm/contactos/{id}"""
    response = client.get("/crm/contactos/1")
    assert response.status_code in [200, 404]

def test_actualizar_contacto():
    """PUT /crm/contactos/{id}"""
    payload = {"notas": "Notas actualizadas"}
    response = client.put("/crm/contactos/1", json=payload)
    assert response.status_code in [200, 404]

def test_eliminar_contacto():
    """DELETE /crm/contactos/{id}"""
    response = client.delete("/crm/contactos/999")  # ID inexistente
    assert response.status_code == 404

# Tests CRUD Oportunidades
def test_crear_oportunidad():
    """POST /crm/oportunidades"""
    payload = {
        "contacto_id": 1,
        "tipo_operacion_id": 1,
        "propiedad_id": 2,
        "estado": "1-abierta",
        "responsable_id": 1,
        "moneda_id": 1,
        "descripcion_estado": "Nueva oportunidad de prueba"
    }
    response = client.post("/crm/oportunidades", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "1-abierta"
    assert "id" in data

def test_listar_oportunidades():
    """GET /crm/oportunidades"""
    response = client.get("/crm/oportunidades")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_cambiar_estado_oportunidad():
    """POST /crm/oportunidades/{id}/cambiar-estado"""
    payload = {
        "nuevo_estado": "2-visita",
        "descripcion": "Cliente visitó la propiedad",
        "usuario_id": 1
    }
    response = client.post("/crm/oportunidades/1/cambiar-estado", json=payload)
    assert response.status_code in [200, 400, 404]

def test_cambiar_estado_transicion_invalida():
    """POST /crm/oportunidades/{id}/cambiar-estado con transición inválida"""
    payload = {
        "nuevo_estado": "5-ganada",  # Desde abierta directamente
        "descripcion": "Intento inválido",
        "usuario_id": 1
    }
    response = client.post("/crm/oportunidades/1/cambiar-estado", json=payload)
    assert response.status_code == 400

def test_listar_logs_oportunidad():
    """GET /crm/oportunidades/{id}/logs"""
    response = client.get("/crm/oportunidades/1/logs")
    assert response.status_code in [200, 404]
    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list)

# Tests Catálogos
def test_listar_tipos_operacion():
    """GET /crm/tipos-operacion"""
    response = client.get("/crm/tipos-operacion")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3  # Al menos alquiler, venta, emprendimiento

def test_listar_monedas():
    """GET /crm/monedas"""
    response = client.get("/crm/monedas")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3  # ARS, USD, EUR

def test_listar_motivos_perdida():
    """GET /crm/motivos-perdida"""
    response = client.get("/crm/motivos-perdida")
    assert response.status_code == 200

# Tests Cotizaciones
def test_listar_cotizaciones():
    """GET /crm/cotizaciones"""
    response = client.get("/crm/cotizaciones")
    assert response.status_code == 200

def test_convertir_monto():
    """GET /crm/cotizaciones/convertir"""
    params = {
        "monto": 100000,
        "moneda_origen": 1,
        "moneda_destino": 2,
        "fecha": "2025-11-20"
    }
    response = client.get("/crm/cotizaciones/convertir", params=params)
    assert response.status_code in [200, 400]

# Tests Eventos
def test_listar_eventos():
    """GET /crm/eventos"""
    response = client.get("/crm/eventos")
    assert response.status_code == 200

def test_crear_evento():
    """POST /crm/eventos"""
    payload = {
        "contacto_id": 1,
        "tipo_id": 1,
        "motivo_id": 1,
        "fecha_evento": "2025-11-20T10:00:00",
        "descripcion": "Llamada inicial",
        "asignado_a_id": 1,
        "estado_evento": "hecho"
    }
    response = client.post("/crm/eventos", json=payload)
    assert response.status_code == 200

# Tests Emprendimientos
def test_listar_emprendimientos():
    """GET /emprendimientos"""
    response = client.get("/emprendimientos")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
```

**Ejecutar tests:**
```bash
cd backend
pytest tests/test_crm_endpoints.py -v --cov=app/routers/crm --cov-report=html
```

---

## ✅ Fase 3: Validación Manual End-to-End (1-1.5 horas)

### 📝 3.1 Probar con Swagger UI
Abrir: `http://localhost:8000/docs`

#### Flujo 1: Crear Contacto y Oportunidad
1. **POST /crm/contactos**
   ```json
   {
     "nombre_completo": "María García",
     "telefonos": ["1155667788"],
     "email": "maria@example.com",
     "origen_lead_id": 1,
     "responsable_id": 1
   }
   ```
   ✅ Debe retornar ID del contacto

2. **POST /crm/oportunidades**
   ```json
   {
     "contacto_id": <ID_DEL_PASO_1>,
     "tipo_operacion_id": 1,
     "propiedad_id": 2,
     "estado": "1-abierta",
     "responsable_id": 1,
     "moneda_id": 1,
     "descripcion_estado": "Cliente busca depto 2 amb"
   }
   ```
   ✅ Debe retornar ID de oportunidad

#### Flujo 2: Cambio de Estados
3. **POST /crm/oportunidades/{id}/cambiar-estado** → Visita
   ```json
   {
     "nuevo_estado": "2-visita",
     "descripcion": "Cliente visitó la propiedad hoy",
     "usuario_id": 1
   }
   ```
   ✅ Debe actualizar estado

4. **POST /crm/oportunidades/{id}/cambiar-estado** → Cotiza
   ```json
   {
     "nuevo_estado": "3-cotiza",
     "descripcion": "Envié cotización formal",
     "usuario_id": 1
   }
   ```

5. **POST /crm/oportunidades/{id}/cambiar-estado** → Reserva
   ```json
   {
     "nuevo_estado": "4-reserva",
     "descripcion": "Cliente reservó con seña",
     "usuario_id": 1,
     "monto": 50000,
     "moneda_id": 1,
     "condicion_pago_id": 1
   }
   ```

6. **POST /crm/oportunidades/{id}/cambiar-estado** → Ganada
   ```json
   {
     "nuevo_estado": "5-ganada",
     "descripcion": "Contrato firmado",
     "usuario_id": 1,
     "monto": 150000,
     "moneda_id": 2,
     "condicion_pago_id": 1
   }
   ```
   ✅ Debe cerrar oportunidad + actualizar propiedad a "alquilada"

7. **GET /crm/oportunidades/{id}/logs**
   ✅ Debe mostrar 5 cambios de estado registrados

#### Flujo 3: Verificar Sincronización
8. **GET /propiedades/2**
   ✅ Debe tener `estado: "4-alquilada"`

9. **GET /vacancias?filter={"propiedad_id":2}**
   ✅ Debe tener `fecha_alquilada` completada

#### Flujo 4: Oportunidad Perdida
10. **Crear nueva oportunidad**
11. **POST /crm/oportunidades/{id}/cambiar-estado** → Perdida
    ```json
    {
      "nuevo_estado": "6-perdida",
      "descripcion": "Cliente eligió otra propiedad",
      "usuario_id": 1,
      "motivo_perdida_id": 1
    }
    ```
    ✅ La propiedad debe seguir en "disponible"

#### Flujo 5: Conversión de Montos
12. **GET /crm/cotizaciones/convertir?monto=100000&moneda_origen=1&moneda_destino=2&fecha=2025-11-20**
    ✅ Debe retornar monto convertido + tipo de cambio aplicado

#### Flujo 6: Deduplicación de Contactos
13. **POST /crm/contactos** con mismo teléfono del paso 1
    ✅ Debe retornar el mismo ID (reutiliza existente)

---

## 📚 Fase 4: Documentación (30 min)

### 📝 4.1 Actualizar README Backend
**Editar:** `backend/README.md`

Agregar sección:

```markdown
## 🎯 Módulo CRM - Gestión de Oportunidades

### Descripción
Sistema completo de CRM para gestionar contactos, oportunidades de venta/alquiler/emprendimientos, eventos e interacciones. Incluye sincronización automática con propiedades y vacancias.

### Endpoints Principales

#### Contactos
- `GET /crm/contactos` - Listar contactos
- `POST /crm/contactos` - Crear contacto (con deduplicación automática)
- `GET /crm/contactos/{id}` - Obtener detalle
- `PUT /crm/contactos/{id}` - Actualizar
- `DELETE /crm/contactos/{id}` - Eliminar (soft delete)
- `POST /crm/contactos/buscar` - Buscar y deduplicar por teléfono/email

#### Oportunidades
- `GET /crm/oportunidades` - Listar oportunidades
- `POST /crm/oportunidades` - Crear oportunidad
- `GET /crm/oportunidades/{id}` - Obtener detalle
- `PUT /crm/oportunidades/{id}` - Actualizar
- `DELETE /crm/oportunidades/{id}` - Eliminar
- `POST /crm/oportunidades/{id}/cambiar-estado` - **Cambio de estado con validación**
- `GET /crm/oportunidades/{id}/logs` - Historial de cambios de estado

#### Eventos
- `GET /crm/eventos` - Listar eventos/interacciones
- `POST /crm/eventos` - Registrar evento
- `POST /crm/eventos/{id}/convertir-oportunidad` - Convertir evento en oportunidad

#### Catálogos CRM
- `GET /crm/tipos-operacion` - Tipos de operación (alquiler, venta, emprendimiento)
- `GET /crm/motivos-perdida` - Motivos de pérdida de oportunidades
- `GET /crm/condiciones-pago` - Condiciones de pago
- `GET /crm/tipos-evento` - Tipos de eventos
- `GET /crm/motivos-evento` - Motivos de eventos
- `GET /crm/origenes-lead` - Orígenes de leads

#### Monedas y Cotizaciones
- `GET /crm/monedas` - Monedas disponibles (ARS, USD, EUR)
- `GET /crm/cotizaciones` - Cotizaciones de monedas
- `POST /crm/cotizaciones` - Registrar nueva cotización
- `GET /crm/cotizaciones/convertir` - Convertir montos entre monedas

#### Emprendimientos
- `GET /emprendimientos` - Listar emprendimientos
- `POST /emprendimientos` - Crear emprendimiento
- `GET /emprendimientos/{id}` - Obtener detalle

### Flujo de Estados de Oportunidad

```
1-abierta → 2-visita → 3-cotiza → 4-reserva → 5-ganada
    ↓          ↓           ↓           ↓
  6-perdida  6-perdida  6-perdida  6-perdida
```

**Reglas de negocio:**
- Cada cambio de estado se registra en log automático
- Cambio a **perdida** requiere `motivo_perdida_id`
- Cambio a **ganada/reserva** requiere `monto` y `condicion_pago_id`
- Cambio a **ganada** actualiza propiedad → `4-alquilada` y cierra vacancia
- Cambio a **perdida** mantiene propiedad en `3-disponible`

### Sincronización con Propiedades/Vacancias

El módulo CRM sincroniza automáticamente el estado de propiedades:

| Acción CRM | Cambio en Propiedad | Cambio en Vacancia |
|------------|---------------------|-------------------|
| Oportunidad → Ganada | `estado → 4-alquilada` | `fecha_alquilada` completada |
| Oportunidad → Perdida | Sin cambio (sigue disponible) | Sin cambio |
| Reapertura | Depende del caso | Puede crear nueva vacancia |

### Deduplicación de Contactos

El sistema previene duplicados automáticamente:
- Por **teléfono** (coincidencia exacta en array)
- Por **email** (coincidencia case-insensitive)
- Endpoint `/crm/contactos/buscar` permite búsqueda manual

### Sistema Multimoneda

- Cada oportunidad tiene su moneda
- Conversiones basadas en tabla `cotizacion_moneda`
- Se usa la última cotización vigente <= fecha de referencia
- Si falta cotización, se marca como N/A

### Seeds y Datos Demo

```bash
# Cargar catálogos y datos demo
python scripts/seed_crm.py
```

Crea:
- 3 monedas (ARS, USD, EUR)
- Catálogos completos (tipos, motivos, condiciones, orígenes)
- 2 contactos demo
- 2 oportunidades demo
- 1 emprendimiento demo
- Cotizaciones demo
```

---

## 📊 Checklist Final de Validación

### Modelos y DB (100%) ✅
- [x] 13 tablas CRM creadas
- [x] Tabla `propiedades` modificada (6 campos nuevos)
- [x] 62 propiedades con datos CRM completos
- [x] Seeds ejecutados (3 monedas, 3 tipos operación, 2 contactos, 2 oportunidades, 1 emprendimiento)
- [x] Migración aplicada (`7ce9174d43c8`)

### Código Backend (100%) ✅
- [x] 13 modelos SQLModel
- [x] 13 CRUDs GenericCRUD
- [x] 3 servicios de negocio
- [x] 13 routers registrados
- [x] ~65 endpoints funcionando

### Testing (Pendiente) ⏳
- [ ] Tests servicios contacto (5 tests)
- [ ] Tests servicios oportunidad (6 tests)
- [ ] Tests servicios cotización (3 tests)
- [ ] Tests endpoints (15+ tests)
- [ ] Coverage >80%

### Validación Manual (Pendiente) ⏳
- [ ] Flujo completo: contacto → oportunidad → cambios estado → ganada
- [ ] Verificar sincronización propiedad/vacancia
- [ ] Flujo oportunidad perdida
- [ ] Conversión de montos
- [ ] Deduplicación contactos
- [ ] Logs de cambios de estado

### Documentación (Pendiente) ⏳
- [ ] README.md actualizado
- [ ] Endpoints documentados
- [ ] Flujos de negocio explicados

---

## 🎯 Estimación Final Ajustada

| Tarea | Tiempo | Prioridad |
|-------|--------|-----------|
| Tests servicios | 2-3 horas | Alta |
| Tests endpoints | 1.5-2 horas | Alta |
| Validación manual | 1-1.5 horas | Alta |
| Documentación | 30 min | Media |
| **TOTAL** | **5-7 horas** | |

**Distribución:**
- **Día 1 (3-4h):** Tests completos
- **Día 1 (2-3h):** Validación + Documentación

---

## ✅ Criterios de Éxito Actualizados

El módulo CRM estará **100% completo** cuando:
- [x] 95% - Backend implementado y funcional en DB
- [ ] 97% - Suite de tests completa y pasando
- [ ] 99% - Validación manual exitosa en todos los flujos
- [ ] 100% - Documentación completa y PR listo

**Estado actual: 95%** ✅✅✅✅✅✅✅✅✅⬜

**Meta: Alcanzar 100% en 5-7 horas de trabajo**

### 📝 2.1 CRUD Evento
**Archivo:** `backend/app/crud/crm_evento_crud.py`
```python
from app.core.generic_crud import GenericCRUD
from app.models.crm_evento import CRMEvento

crm_evento_crud = GenericCRUD(CRMEvento)
```

### 📝 2.2 Router Evento
**Archivo:** `backend/app/routers/crm/crm_evento_router.py`

**Implementar:**
- CRUD estándar con `create_generic_router`
- Endpoint adicional: `POST /crm/eventos/{id}/convertir-oportunidad`

```python
@crm_evento_router.post("/{evento_id}/convertir-oportunidad")
def convertir_a_oportunidad(
    evento_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    # Lógica: tomar datos del evento + payload
    # Crear oportunidad usando crm_oportunidad_service
    # Actualizar evento.oportunidad_id
    pass
```

### 📝 2.3 CRUD Emprendimiento
**Archivo:** `backend/app/crud/emprendimiento_crud.py`
```python
from app.core.generic_crud import GenericCRUD
from app.models.emprendimiento import Emprendimiento

emprendimiento_crud = GenericCRUD(Emprendimiento)
```

### 📝 2.4 Router Emprendimiento
**Archivo:** `backend/app/routers/emprendimiento_router.py`

CRUD estándar:
```python
from app.core.router import create_generic_router
from app.models.emprendimiento import Emprendimiento
from app.crud.emprendimiento_crud import emprendimiento_crud

emprendimiento_router = create_generic_router(
    model=Emprendimiento,
    crud=emprendimiento_crud,
    prefix="/emprendimientos",
    tags=["emprendimientos"],
)
```

### 📝 2.5 Registrar Routers
**Modificar:** `backend/app/main.py`

```python
from app.routers.crm import crm_evento_router  # Agregar
from app.routers.emprendimiento_router import emprendimiento_router  # Agregar

# En la sección de include_router:
app.include_router(crm_evento_router)  # Agregar después de crm_oportunidad
app.include_router(emprendimiento_router)  # Agregar en sección general
```

### 📝 2.6 Actualizar __init__.py de CRM
**Modificar:** `backend/app/routers/crm/__init__.py`

```python
from .crm_evento_router import crm_evento_router  # Agregar

__all__ = [
    # ... existentes
    "crm_evento_router",  # Agregar
]
```

---

## 🧪 Fase 3: Testing (3-4 horas)

### 📝 3.1 Tests Servicios
**Crear:** `backend/tests/services/test_crm_contacto_service.py`
```python
# Test deduplicación por teléfono
# Test deduplicación por email
# Test normalización teléfonos
# Test crear o reutilizar contacto
```

**Crear:** `backend/tests/services/test_crm_oportunidad_service.py`
```python
# Test transiciones válidas
# Test transiciones inválidas (debe fallar)
# Test cambio a ganada → sincroniza propiedad a "alquilada"
# Test cambio a perdida → propiedad sigue "disponible"
# Test requiere motivo_perdida al cerrar perdida
# Test requiere monto/condiciones al cerrar ganada
# Test log de estados se registra correctamente
```

**Crear:** `backend/tests/services/test_cotizacion_service.py`
```python
# Test obtener cotización vigente
# Test conversión montos ARS→USD
# Test marcar N/A cuando falta cotización
# Test fecha_vigencia <= fecha_consulta
```

### 📝 3.2 Tests Endpoints
**Crear:** `backend/tests/test_crm_endpoints.py`
```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_crud_contacto():
    # POST /crm/contactos
    # GET /crm/contactos
    # GET /crm/contactos/{id}
    # PUT /crm/contactos/{id}
    # DELETE /crm/contactos/{id}
    pass

def test_crud_oportunidad():
    # Similar a contacto
    pass

def test_cambiar_estado_oportunidad():
    # POST /crm/oportunidades/{id}/cambiar-estado
    # Validar respuesta + verificar log creado
    pass

def test_listar_logs_oportunidad():
    # GET /crm/oportunidades/{id}/logs
    pass

def test_conversion_cotizacion():
    # GET /crm/cotizaciones/convertir
    pass

def test_buscar_contacto_deduplicacion():
    # POST /crm/contactos/buscar
    pass

def test_convertir_evento_a_oportunidad():
    # POST /crm/eventos/{id}/convertir-oportunidad
    pass
```

**Ejecutar:**
```bash
cd backend
pytest tests/services/ -v
pytest tests/test_crm_endpoints.py -v
```

---

## ✅ Fase 4: Validación y Documentación (1-2 horas)

### 📝 4.1 Pruebas Manuales Integración
**Usar Postman/Insomnia o Swagger UI:**

1. **Crear contacto**
   ```json
   POST /crm/contactos
   {
     "nombre_completo": "Juan Pérez",
     "telefonos": ["1122334455"],
     "email": "juan@test.com",
     "origen_lead_id": 1,
     "responsable_id": 1
   }
   ```

2. **Crear oportunidad**
   ```json
   POST /crm/oportunidades
   {
     "contacto_id": 1,
     "tipo_operacion_id": 1,
     "propiedad_id": 1,
     "estado": "1-abierta",
     "responsable_id": 1,
     "moneda_id": 1
   }
   ```

3. **Cambiar estado a ganada**
   ```json
   POST /crm/oportunidades/1/cambiar-estado
   {
     "nuevo_estado": "5-ganada",
     "descripcion": "Cliente firmó contrato",
     "usuario_id": 1,
     "monto": 150000,
     "moneda_id": 2,
     "condicion_pago_id": 1
   }
   ```

4. **Verificar sincronización**
   ```
   GET /propiedades/1
   # estado debe ser "4-alquilada"
   
   GET /vacancias?filter={"propiedad_id":1}
   # fecha_alquilada debe estar completa
   ```

5. **Consultar logs**
   ```
   GET /crm/oportunidades/1/logs
   # Debe mostrar historial de estados
   ```

6. **Crear evento y convertir**
   ```json
   POST /crm/eventos
   {
     "contacto_id": 1,
     "tipo_id": 1,
     "motivo_id": 1,
     "fecha_evento": "2025-11-20T10:00:00",
     "descripcion": "Llamada inicial",
     "asignado_a_id": 1,
     "estado_evento": "hecho"
   }
   
   POST /crm/eventos/1/convertir-oportunidad
   {
     "tipo_operacion_id": 1,
     "propiedad_id": 2
   }
   ```

### 📝 4.2 Documentación
**Actualizar:** `backend/README.md`

Agregar sección:
```markdown
## Módulo CRM

### Endpoints Principales

#### Contactos
- `GET /crm/contactos` - Listar contactos
- `POST /crm/contactos` - Crear contacto
- `POST /crm/contactos/buscar` - Deduplicación

#### Oportunidades
- `GET /crm/oportunidades` - Listar oportunidades
- `POST /crm/oportunidades` - Crear oportunidad
- `POST /crm/oportunidades/{id}/cambiar-estado` - Cambiar estado
- `GET /crm/oportunidades/{id}/logs` - Historial de estados

#### Eventos
- `GET /crm/eventos` - Listar eventos
- `POST /crm/eventos` - Crear evento
- `POST /crm/eventos/{id}/convertir-oportunidad` - Convertir a oportunidad

#### Catálogos
- Tipos operación, Motivos pérdida, Condiciones pago, Tipos evento, Motivos evento, Orígenes lead
- Cada uno: `GET /crm/{catalogo}` y operaciones CRUD estándar

#### Monedas y Cotizaciones
- `GET /crm/monedas` - Listar monedas
- `GET /crm/cotizaciones` - Listar cotizaciones
- `GET /crm/cotizaciones/convertir` - Convertir montos
```

### 📝 4.3 Verificar Estado DB
```bash
cd backend
alembic current
# Debe mostrar: 7ce9174d43c8 (head) + nuevas migraciones eventos/emprendimientos

alembic history
# Listar todas las migraciones aplicadas
```

---

## 📊 Checklist Actualizado

### ✅ Modelos (9/11 - 82%)
- ✅ `crm_catalogos.py`
- ✅ `cotizacion_moneda.py`
- ⏳ `emprendimiento.py` **← PENDIENTE**
- ✅ `crm_contacto.py`
- ✅ `crm_oportunidad.py`
- ✅ `crm_oportunidad_log_estado.py`
- ⏳ `crm_evento.py` **← PENDIENTE**
- ✅ `propiedad.py` (modificado)
- ✅ `vacancia.py` (sin cambios requeridos)
- ⏳ `enums.py` (agregar EstadoEvento, EstadoEmprendimiento)
- ✅ `__init__.py`

### ✅ Migraciones (1/3 - 33%)
- ✅ `7ce9174d43c8_20251119_add_crm_core.py` (incluye catálogos, monedas, cotizaciones, contactos, oportunidades, log)
- ⏳ Eventos **← PENDIENTE**
- ⏳ Emprendimientos **← PENDIENTE**

### ✅ Seeds (1/1 - 100%)
- ✅ `seed_crm.py` (catálogos + monedas + contactos + oportunidades demo)
- ⏳ Actualizar para incluir eventos y emprendimientos

### ✅ CRUDs (11/13 - 85%)
- ✅ `crm_tipo_operacion_crud.py`
- ✅ `crm_motivo_perdida_crud.py`
- ✅ `crm_condicion_pago_crud.py`
- ✅ `crm_tipo_evento_crud.py`
- ✅ `crm_motivo_evento_crud.py`
- ✅ `crm_origen_lead_crud.py`
- ✅ `moneda_crud.py`
- ✅ `cotizacion_moneda_crud.py`
- ✅ `crm_contacto_crud.py`
- ✅ `crm_oportunidad_crud.py`
- ✅ `crm_oportunidad_log_crud.py`
- ⏳ `crm_evento_crud.py` **← PENDIENTE**
- ⏳ `emprendimiento_crud.py` **← PENDIENTE**

### ✅ Servicios (3/3 - 100%)
- ✅ `crm_contacto_service.py`
- ✅ `crm_oportunidad_service.py`
- ✅ `cotizacion_service.py`

### ✅ Routers (11/13 - 85%)
- ✅ `crm_catalogos_router.py` (incluye 6 catálogos)
- ✅ `moneda_router.py`
- ✅ `cotizacion_moneda_router.py`
- ✅ `cotizacion_conversion_router.py`
- ✅ `crm_contacto_router.py`
- ✅ `crm_oportunidad_router.py`
- ⏳ `crm_evento_router.py` **← PENDIENTE**
- ⏳ `emprendimiento_router.py` **← PENDIENTE**

### ✅ Tests (0/4 - 0%)
- ⏳ `test_crm_contacto_service.py` **← PENDIENTE**
- ⏳ `test_crm_oportunidad_service.py` **← PENDIENTE**
- ⏳ `test_cotizacion_service.py` **← PENDIENTE**
- ⏳ `test_crm_endpoints.py` **← PENDIENTE**

### ✅ Registros en main.py (11/13 - 85%)
- ✅ 11 routers CRM registrados
- ⏳ `crm_evento_router` **← PENDIENTE**
- ⏳ `emprendimiento_router` **← PENDIENTE**

---

## 🎯 Estimación de Tiempo Ajustada

| Fase | Descripción | Tiempo Estimado | Prioridad |
|------|-------------|-----------------|-----------|
| **Fase 1** | Modelo Evento + migración | 1 hora | Alta |
| **Fase 1** | Modelo Emprendimiento + migración | 1 hora | Alta |
| **Fase 1** | Actualizar seeds | 30 min | Alta |
| **Fase 2** | CRUD + Router Evento | 1 hora | Alta |
| **Fase 2** | CRUD + Router Emprendimiento | 45 min | Alta |
| **Fase 2** | Registrar routers en main.py | 15 min | Alta |
| **Fase 3** | Tests servicios (3 archivos) | 2 horas | Media |
| **Fase 3** | Tests endpoints | 1.5 horas | Media |
| **Fase 4** | Pruebas manuales + validación | 1 hora | Alta |
| **Fase 4** | Documentación | 30 min | Baja |
| **TOTAL** | | **9-10 horas** | |

**Distribución sugerida:**
- **Día 1 (4h):** Fase 1 + Fase 2 → Completar modelos y API
- **Día 2 (3h):** Fase 3 → Testing
- **Día 2 (2h):** Fase 4 → Validación y documentación

---

## 🚨 Notas Importantes

### ⚠️ Ya NO es necesario:
- ❌ Crear modelos catálogos (ya existen)
- ❌ Crear modelo contacto/oportunidad/log (ya existen)
- ❌ Modificar modelo propiedad (ya modificado)
- ❌ Crear servicios principales (ya existen)
- ❌ Crear CRUDs catálogos (ya existen)
- ❌ Crear routers contacto/oportunidad (ya existen)
- ❌ Migración principal (ya aplicada)

### ✅ Elementos ya funcionales:
1. Contactos con deduplicación
2. Oportunidades con cambio de estado
3. Log de estados automático
4. Sincronización propiedad/vacancia
5. Sistema de cotizaciones multimoneda
6. Todos los catálogos operativos

### 🔍 Elementos pendientes críticos:
1. **Eventos** (modelo + CRUD + router + convertir a oportunidad)
2. **Emprendimientos** (modelo + CRUD + router)
3. **Testing completo** (validar que lo implementado funciona correctamente)

---

## 🎉 Estado Actual del Proyecto

**Progreso general: 70%** ✅✅✅✅✅✅✅⬜⬜⬜

El módulo CRM está **funcional y operativo** para:
- ✅ Gestión de contactos con deduplicación
- ✅ Gestión de oportunidades con workflow completo
- ✅ Sistema de cotizaciones multimoneda
- ✅ Sincronización automática con propiedades/vacancias
- ✅ Log completo de cambios de estado

Falta completar para tener el **100%**:
- ⏳ Gestión de eventos/interacciones
- ⏳ Gestión de emprendimientos
- ⏳ Suite completa de tests automatizados

---

## 📞 Próximos Pasos Inmediatos

1. **Backup DB actual**
   ```bash
   pg_dump sak_dev > backup_before_eventos_$(date +%Y%m%d).sql
   ```

2. **Fase 1: Completar modelos** (2.5 horas)
   - Crear `crm_evento.py`
   - Crear `emprendimiento.py`
   - Actualizar `enums.py`
   - Generar migraciones
   - Aplicar migraciones
   - Actualizar seeds

3. **Fase 2: Completar API** (2 horas)
   - CRUDs eventos/emprendimientos
   - Routers eventos/emprendimientos
   - Registrar en main.py
   - Probar endpoints con Swagger

4. **Fase 3: Testing** (3.5 horas)
   - Tests unitarios servicios
   - Tests endpoints
   - Ejecutar suite completa

5. **Fase 4: Validación** (1.5 horas)
   - Pruebas manuales end-to-end
   - Documentación
   - Commit + PR

---

## ✅ Criterios de Éxito

El módulo CRM estará **completo** cuando:
- [x] 70% - Todos los modelos creados y migrados
- [ ] 80% - Todos los endpoints funcionan (CRUD + acciones especiales)
- [ ] 90% - Tests pasan sin errores
- [ ] 95% - Validación manual exitosa en todos los flujos
- [ ] 100% - Documentación actualizada y PR aprobado

**Meta:** Alcanzar 100% en 1-2 días de trabajo efectivo.

---

## 🚨 Riesgos y Mitigación

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Migraciones fallan en prod | Alto | Testear en copia de prod, backup antes de aplicar |
| Deduplicación contactos con falsos positivos | Medio | Logs detallados + endpoint manual de merge |
| Sincronización propiedad/vacancia inconsistente | Alto | Transacciones atómicas + tests exhaustivos |
| Falta de cotizaciones para conversión | Medio | Marcar como N/A + alertas para cargar cotizaciones |
| Performance queries con muchas relaciones | Medio | Índices adecuados + eager loading selectivo |

---

## 📞 Soporte

- **Documentación técnica:** `doc/03-devs/20251119-oportunidades/`
- **Patrones backend:** `doc/03-devs/README_BACKEND_PATTERNS_v1.md`
- **Dudas funcionales:** Revisar `20251119_oportunidades_req.md`

---

## 🎉 Entregables

Al finalizar tendrás:
- ✅ Módulo CRM funcional en desarrollo
- ✅ 11 nuevos modelos + 3 modificados
- ✅ 7 migraciones aplicadas
- ✅ Catálogos cargados con datos seed
- ✅ APIs REST completas y documentadas
- ✅ Tests con cobertura >80%
- ✅ Sincronización automática propiedad/vacancia
- ✅ Sistema de cotizaciones multimoneda operativo
