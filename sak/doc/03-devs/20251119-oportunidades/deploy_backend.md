# Plan paso a paso - Implementación CRM Backend

## 1. Preparación y diseño
1. Revisar `doc/03-devs/20251119-oportunidades/20251119_oportunidades_spec_backend.md` y aclarar dudas con el equipo funcional (estados, sincronización Propiedad/Vacancia, catálogos CRM).
2. Validar disponibilidad de recursos: versión de DB, herramientas de migración (Alembic), variables de entorno.

## 2. Modelos y migraciones
1. Crear archivos de modelos nuevos en `backend/app/models`:
   - `crm_catalogos.py` (CRMTipoOperacion, CRMMotivoPerdida, etc.).
   - `crm_contacto.py`, `crm_oportunidad.py`, `crm_oportunidad_log_estado.py`, `crm_evento.py`, `emprendimiento.py` (si no existe) y ajustes en `propiedad.py`, `vacancia.py`, `enums.py`.
2. Actualizar `backend/app/models/__init__.py` para exportar nuevos modelos y enums.
3. Generar migraciones Alembic en este orden:
   - 001: catálogos CRM + monedas (si aplica) + cotizacion_moneda.
   - 002: emprendimientos.
   - 003: modificar propiedades (nuevas columnas FK + coste/monedas).
   - 004: CRMContactos.
   - 005: CRMOportunidades.
   - 006: CRMOportunidadLogEstado.
   - 007: CRMEventos.
   - 008: ajustes a vacancias (sin FK a oportunidad, nuevos índices/columnas necesarias). 
4. Ejecutar migraciones en entorno local y validar schema.

## 3. Seeds / scripts auxiliares
1. Ejecutar `python scripts/seed_crm.py` para cargar catálogos (tipos, motivos, condiciones, origenes), monedas/cotizaciones y datos demo (contactos, oportunidades, eventos). Si los IDs de propiedades definidos en la semilla no existen en el ambiente, el script reutiliza el primer registro de `propiedades` y deja un warning.
2. Ejecutar `python scripts/seed_propiedades.py` para completar los campos nuevos de `propiedades` (`tipo_operacion_id`, `emprendimiento_id`, `costo_propiedad`, `costo_moneda_id`, `precio_venta_estimado`, `precio_moneda_id`). Criterio: si los campos están nulos se asignan valores por defecto (tipo operación "alquiler", emprendimiento demo asociado al primer usuario existente, costos en ARS por 1.000.000 y precios estimados en USD por 150.000). Este seed asegura que la migración no deje columnas recientes en blanco y facilita la creación de oportunidades sobre registros consistentes.

## 4. CRUDs y servicios
1. Generar instancias `GenericCRUD` en `backend/app/crud`:
   - `crm_tipo_operacion_crud.py`, `crm_motivo_perdida_crud.py`, `crm_condicion_pago_crud.py`, `crm_tipo_evento_crud.py`, `crm_motivo_evento_crud.py`, `crm_origen_lead_crud.py`, `moneda_crud.py`, `cotizacion_moneda_crud.py`, `crm_contacto_crud.py`, `crm_oportunidad_crud.py`, `crm_oportunidad_log_crud.py`, `crm_evento_crud.py`, `emprendimiento_crud.py`.
2. Implementar servicios en `backend/app/services`:
   - `crm_contacto_service.py`: normalización + deduplicación (alta o reuse).
   - `crm_oportunidad_service.py`: transiciones de estado, sincronización Propiedad/Vacancia, creación desde evento, conversión de montos.
   - `cotizacion_service.py`: resolver cotizaciones vigentes y conversiones.
3. Mantener `app/core/generic_crud.py` sin lógica específica de CRM; cualquier necesidad especial debe resolverse en los servicios/routers del módulo.

## 5. Routers y endpoints
1. Crear sub-paquete `backend/app/routers/crm/` con routers:
   - Catálogos (`crm_tipo_operacion_router`, etc.) usando `create_generic_router`.
   - `crm_contacto_router`, `crm_oportunidad_router`, `crm_oportunidad_log_router`, `crm_evento_router`, `emprendimiento_router`, `cotizacion_router`.
2. Añadir endpoints adicionales:
   - `POST /crm/contactos/buscar`.
   - `POST /crm/oportunidades/{id}/cambiar-estado`.
   - `GET /crm/oportunidades/{id}/logs` (list only) si no basta con el router genérico.
   - `GET /crm/cotizaciones/convertir`.
3. Actualizar `app/routers/__init__.py` y `app/main.py` para incluir los nuevos routers.
4. Modificar `propiedad_router.cambiar_estado` para delegar más lógica en `crm_oportunidad_service` (sin mantener FK en vacancia).

## 6. Validaciones Frontend/Backend
1. Documentar en `models.ts` los esquemas Zod por entidad según la tabla de responsabilidades.
2. Exponer catálogos vía endpoints para que el frontend consuma códigos comunes y evite harcode.

## 7. Testing
1. Crear pruebas unitarias para servicios:
   - `tests/services/test_crm_contacto_service.py`, `tests/services/test_crm_oportunidad_service.py`, `tests/services/test_cotizacion_service.py`.
2. Actualizar `tests/test_endpoints.py` o crear nuevos archivos para cubrir endpoints `/crm/...` (alta/edición/lista/cambio de estado, conversión de cotizaciones, deduplicación de contactos, etc.).
3. Añadir seeds de datos de prueba si hacen falta (fixtures pytest).

## 8. Deploy / DevOps
1. Crear documento `deploy_backend.md` en `doc/03-devs/20251119-oportunidades/` con:
   - Pasos para ejecutar migraciones en staging/producción.
   - Ejecución de `seed_crm.py` (si corresponde).
   - Validaciones post-deploy (endpoints health, creación básica de oportunidad, etc.).
2. Actualizar pipelines CI/CD (si los hay) para incluir tests nuevos y migraciones.

## 9. Checklist de cierre
1. Confirmar que los endpoints `/crm/...` están registrados y protegidos por auth (si aplica).
2. Validar que el frontend consume los catálogos y modelos nuevos.
3. Revisar logs de sincronización Propiedad/Vacancia cuando se cambian estados.
4. Documentar retroalimentación aprendida en el repo (README o doc adicional).
