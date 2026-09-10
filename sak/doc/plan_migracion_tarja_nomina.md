# Plan de migración funcional: `tarjaNovedades` -> `tarjaNomina`

## Objetivo
Reemplazar directamente la funcionalidad de `TarjaNovedad` por `TarjaNomina` como entidad activa de negocio, sin mantener un traductor ni una capa de compatibilidad funcional.

## Principio de diseño
- `TarjaNomina` es la fuente de verdad para los registros de nómina asociados a una tarja.
- `TarjaNovedad` queda solo como legado histórico o compatibilidad puntual de diagnóstico, no como base para la lógica productiva.
- No se mantiene una capa de traducción entre ambas entidades.
- Los campos que cambian de semántica se modelan como `flag + importe`.

## Mapa de semántica actual

### Legacy: `TarjaNovedad`
Campos relevantes:
- `tarja_id`
- `nomina_id`
- `nomina_categoria_id`
- `nomina_tarea_id`
- `horas_justificadas`
- `presentismo` (bool)
- `adicional` (Decimal)
- `premio` (Decimal)
- `observaciones`
- `documentos`

### Nueva: `TarjaNomina`
Campos relevantes:
- `tarja_id`
- `nomina_id`
- `nomina_categoria_id`
- `nomina_tarea_id`
- `horas_justificadas`
- `presentismo` (bool)
- `presentismo_importe` (Decimal)
- `adicional_importe` (Decimal)
- `premio` (bool)
- `premio_importe` (Decimal)
- `viatico` (bool)
- `viatico_importe` (Decimal)
- `sueldo_importe` (Decimal)
- `mejora_importe` (Decimal)
- `cargas_importe` (Decimal)
- `fecha_desde` (Date)
- `fecha_hasta` (Date)
- `observaciones`
- `documentos`

### Mapeo funcional recomendado
- `tarja_id` -> igual
- `nomina_id` -> igual
- `nomina_categoria_id` -> igual
- `nomina_tarea_id` -> igual
- `horas_justificadas` -> igual
- `presentismo` -> igual
- `presentismo_importe` -> calcular/llenar en lógica nueva
- `adicional` -> `adicional_importe`
- `premio` legacy (monto) -> `premio` bool + `premio_importe`
- `observaciones` -> igual
- `documentos` -> igual
- `viatico`, `sueldo_importe`, `mejora_importe`, `cargas_importe` -> nuevos, se completan según reglas de negocio o default seguro
- `fecha_desde` y `fecha_hasta` -> nuevos y obligatorios para la nueva entidad

---

## Tareas por archivo

### 1) Modelo y contrato de negocio
Archivo: `backend/app/models/tarja.py`

Checklist:
- [ ] Confirmar que `TarjaNomina` es la entidad base para la nueva lógica.
- [ ] Revisar la semántica de cada campo nuevo y definir qué flujo lo calcula.
- [ ] Asegurar que los campos `flag + importe` estén bien nombrados y documentados.
- [ ] Confirmar que `TarjaNovedad` queda como entidad legacy, no como fuente para nuevos desarrollos.

Notas:
- El modelo ya representa la estructura base correcta.
- Ahora hay que hacer que la app funcional la use realmente.

---

### 2) Reemplazo directo de la lógica de negocio
Archivo: `backend/app/services/parte_diario_tarja_service.py`

Checklist:
- [ ] Eliminar la lógica productiva basada en `TarjaNovedad` y hacer que la escritura se realice directamente en `TarjaNomina`.
- [ ] Revisar y renombrar cualquier helper heredado que siga llamándose `_sync_tarja_novedades` si ya no aplica.
- [ ] Asegurar que se deduplica por `(tarja_id, nomina_id)` en la nueva entidad.
- [ ] Completar `fecha_desde` y `fecha_hasta` desde la tarja base.
- [ ] Calcular `presentismo_importe` según la regla del negocio real.
- [ ] Calcular `adicional_importe` a partir de la fuente de datos actual, sin pasar por traducción legacy.
- [ ] Calcular `premio_importe` y setear `premio = (premio_importe > 0)`.
- [ ] Completar `viatico_importe` si corresponde a la regla vigente.
- [ ] Completar `sueldo_importe`, `mejora_importe`, `cargas_importe` con defaults o cálculo real.
- [ ] Verificar que no queden filas duplicadas ni inconsistentes.

Regla de prudencia:
- Si un campo nuevo no tiene origen claro en la lógica actual, no inventar una traducción; definir la regla en la nueva entidad y documentarla.

---

### 3) Router principal de tarjas
Archivo: `backend/app/routers/tarja_router.py`

Checklist:
- [ ] Reemplazar consultas a `TarjaNovedad` por `TarjaNomina` en endpoints de listado y agregados.
- [ ] Ajustar los totals y summaries para usar los nuevos campos de importe.
- [ ] Verificar los campos del payload final devueltos al frontend.
- [ ] Mantener compatibilidad temporal si algún frontend aún espera nombres legacy.
- [ ] Revisar los joins y queries que hoy factorizan por `TarjaNovedad`.

Puntos críticos:
- Totales por tarja
- Conteo por empleado
- Sumas de adicional/premio
- Response payload del detalle de tarja

---

### 4) Router de detalle de tarja
Archivo: `backend/app/routers/tarja_detalle_router.py`

Checklist:
- [ ] Cambiar el origen de datos de `TarjaNovedad` a `TarjaNomina`.
- [ ] Revisar consultas con `NominaCategoria` y `NominaTarea`.
- [ ] Asegurar que el detalle de cada empleado exponga los campos nuevos correctamente.
- [ ] Ajustar los descriptores de salida para no seguir devolviendo `adicional` o `premio` como cantidades sin flag.
- [ ] Validar que el payload de detalle siga siendo consistente para el frontend.

---

### 5) Router legacy de novedades
Archivo: `backend/app/routers/tarja_novedad_router.py`

Checklist:
- [ ] Dejarlo como compatibilidad histórica, sin uso funcional productivo.
- [ ] No usarlo en nuevos flujos.
- [ ] Mantenerlo solo para soporte o diagnóstico.
- [ ] Eliminarlo cuando la nueva lógica de `TarjaNomina` esté validada y estable.

---

### 6) Router nuevo de nómina
Archivo: `backend/app/routers/tarja_nomina_router.py`

Checklist:
- [ ] Validar que el CRUD sigue el patrón del legacy y cumple con la deduplicación esperada.
- [ ] Confirmar que el prefijo y endpoints estén bien registrados en `app/main.py`.
- [ ] Revisar filtros por `tarja_id` y `nomina_id`.
- [ ] Asegurar que el router expone los campos nuevos y no solo los legacy.

---

### 7) Flujo de frontend / consumo de API
Checklist:
- [ ] Revisar componentes que se alimentan con campos de `novedad`.
- [ ] Cambiar nombre y semántica de los campos esperados por frontend.
- [ ] Mapear:
  - `adicional` -> `adicional_importe`
  - `premio` -> `premio` bool + `premio_importe`
  - `presentismo` -> bool
  - `presentismo_importe` -> propio
  - `viatico` -> propio
  - `sueldo_importe`, `mejora_importe`, `cargas_importe` -> propios
- [ ] No mantener adaptador funcional; solo usar la nueva nomenclatura en la capa de API y frontend.

---

### 8) Compatibilidad y estrategia de reemplazo
Checklist:
- [ ] Mantener `TarjaNovedad` solo como entidad histórica, no como fuente productiva.
- [ ] Registrar una comparación de datos si hace falta para auditoría.
- [ ] Verificar que la nueva entidad cubre la lógica actual sin regresiones.
- [ ] Definir el corte final para desactivar la legacy en producción.
- [ ] Hacer limpieza final solo cuando la funcionalidad esté validada.

---

### 9) Validación y pruebas
Checklist:
- [ ] Ejecutar pruebas unitarias de modelo y router de `TarjaNomina`.
- [ ] Probar el flujo de sincronización de tarja con datos reales.
- [ ] Validar que no aparecen duplicados por `(tarja_id, nomina_id)`.
- [ ] Validar payloads de endpoints principales.
- [ ] Validar que no hay reads de `TarjaNovedad` en la lógica principal.
- [ ] Verificar que la UI no rompe al recibir los nuevos nombres de campos.

---

## Orden recomendado de ejecución
1. Reemplazo directo de servicios y handlers productivos
2. Routers de lectura
3. Endpoint de detalle
4. Payload frontend
5. Corte de compatibilidad legacy
6. Limpieza final

## Criterio de cierre
La migración funcional se considera cerrada cuando:
- la app escribe en `TarjaNomina`
- la app lee en `TarjaNomina`
- no existe lógica principal dependiente de `TarjaNovedad`
- los campos nuevos están siendo usados con semántica correcta
- legacy queda solo como historial o diagnóstico, sin participación funcional

---

## Observación importante
La estrategia recomendada no es mantener un traductor ni una doble fuente de verdad. Es un reemplazo funcional directo: `TarjaNomina` pasa a ser la entidad real de negocio, mientras `TarjaNovedad` queda solo como dato histórico y no como base de la funcionalidad actual.
