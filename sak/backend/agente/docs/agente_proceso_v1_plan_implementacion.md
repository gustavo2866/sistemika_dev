# Plan de implementación del agente de obra v1

## 1. Objetivo

Implementar el diseño conversacional documentado para el agente de WhatsApp:

- Mantener el proceso actual de pedidos de materiales, incorporando únicamente los
  ajustes puntuales definidos.
- Incorporar el nuevo proceso de parte diario de asistencia.
- Agregar un proceso general que active el sub-proceso correcto cuando no existe uno
  abierto.
- Garantizar un único proceso activo por conversación.
- Materializar la información en DB antes de enviar el mensaje final de éxito.

Este documento es una hoja de ruta de alto nivel. No reemplaza los diseños funcionales:

- [Diseño común](./agente_proceso_v1.design)
- [Pedido de obra](./agente_proceso_v1_pedido_obra.design)
- [Parte diario](./agente_proceso_v1_parte_diario.design)
- [Guía funcional para usuarios](./agente_proceso_v1.md)

## 2. Separación de responsabilidades

La implementación se divide deliberadamente en cuatro bloques:

| Bloque | Alcance |
|--------|---------|
| Modelos, tablas y datos | Esquema DB, migraciones, constraints, seed y saneamiento de datos existentes |
| Runtime común | Recepción segura, serialización de turnos, deduplicación, idempotencia técnica y retry de delivery |
| Funcionalidad conversacional | Orquestación, `GeneralProcess`, ajustes de `pedido_obra` y nuevo proceso `parte_diario` |
| Verificación y despliegue | Tests, auditoría de datos, observabilidad, rollout y rollback |

Los cambios de DB se preparan y validan antes de habilitar la nueva funcionalidad. Los
sub-procesos no implementan lógica propia para resolver concurrencia, duplicados de
webhook o retries técnicos.

### 2.1 Estado de ejecución

Implementado y verificado en Neon de test:

- Migraciones y seed de persistencia requeridos por `parte_diario`.
- Constraints `UNIQUE (idproyecto, fecha)` y
  `UNIQUE (parte_diario_id, idnomina)`.
- Seed idempotente de `parte_diario_estados`, preservando valores administrados.
- Deduplicación durable de mensajes entrantes por identificador externo de Meta.
- Saneamiento controlado de duplicados técnicos existentes en la base de test.
- Retry durable del delivery: se registra `pending` antes de enviar y se reutiliza el
  resultado persistido del agente si falla WhatsApp. Un `pending` reciente bloquea
  reenvíos concurrentes; un `pending` abandonado se recupera al vencer su lease y los
  fallos aplican backoff antes del retry automático.
- Lease durable por `oportunidad_id`, sin mantener una transacción abierta durante la
  espera al LLM.
- Limpieza acotada de datos previos de prueba vinculados al agente, mensajes, webhooks y
  pedidos generados por agente. Los catálogos y datos maestros se preservaron.
- `GeneralProcess`, schema estricto y activate-and-forward dentro del mismo turno.
- Adaptación conservadora de `pedido_obra`: `CONFIRMAR` y `CANCELAR` exactos, schema del
  LLM no destructivo y bloqueo de cambio de proceso.
- Nuevo proceso `parte_diario`: resolución local de nómina, internos y externos,
  normalización de horas, ambigüedades, conflictos, fechas, borradores y partes cerrados.
- `ParteDiarioService.create_or_update_from_agent_message()`: validación defensiva,
  reemplazo completo de detalles y presentes implícitos.
- Integración del parte diario con el webhook: materialización previa al delivery y
  cierre conversacional únicamente después del commit.
- Regresión automatizada unitaria y de integración del canal.
- Datasets de eval sintéticos y anonimizados versionados para intención general,
  `pedido_obra`, `parte_diario` y fallback acotado de estado.

Pendiente antes del rollout:

- Ejecutar contra el proveedor los evals versionados del LLM. El entorno local actual no
  tiene `OPENAI_API_KEY` configurada.
- Realizar smoke tests con proveedor en entorno de prueba.
- Habilitar rollout gradual y verificar observabilidad operativa.

### 2.2 Verificación automatizada local

Resultado al 2026-06-01:

- `pytest tests/unit tests/api/test_channel_meta_webhook.py tests/api/test_constructora_pedido_service.py tests/api/test_crm_chat_ai_v2.py -q`
  pasa con `196 passed`.
- `pytest tests/api -q` ejecuta `123 passed` y conserva `14 failed` históricos fuera del
  alcance de este cambio: siete expectativas del agente anterior en
  `test_crm_chat_ai_v2_architecture.py`, una ruta ausente de clientes y seis rutas
  ausentes de órdenes de compra.
- La herramienta manual de smoke test se movió a `scripts/chat_agent_smoke.py`. Ya no
  interfiere con la colección de `pytest tests -q` y permite inspeccionar respuestas de
  `pedido_obra`, `parte_diario` y del proceso general.
- `python -m compileall` y `git diff --check` completan sin errores.

## 3. Decisiones funcionales

Esta sección registra decisiones de dominio relevantes para la implementación. Los puntos
marcados como pendientes no bloquean la preparación del plan, pero sí bloquean el código
definitivo del sub-proceso.

### 3.1 Fuente de verdad del catálogo de estados

**Resuelto:** los estados admitidos se obtienen de los registros activos de
`parte_diario_estados`. Esta tabla es la única fuente de verdad del catálogo operativo.
El agente no mantiene una lista fija de códigos en el prompt ni en el código.

En cada turno que lo requiera, el backend carga el catálogo activo y lo utiliza para:

- Opciones mostradas al encargado.
- Enum dinámico del schema del LLM.
- Validación de abreviaturas devueltas por el LLM.
- Resolución local por número de opción, abreviatura o nombre.
- Tests.

Los ejemplos de códigos incluidos en los documentos son ilustrativos. La disponibilidad
real de cada estado depende de la tabla. Un seed idempotente puede inicializar el catálogo,
pero no reemplaza a la tabla como fuente de verdad durante la ejecución.

### 3.2 Horas no informadas y personal externo

**Resuelto:** la normalización de horas aplica el mismo default para empleados internos y
externos:

- Si se menciona una persona sin informar horas ni una ausencia explícita, el backend
  utiliza `9.0`.
- Si el mensaje informa una ausencia total, por ejemplo `"faltó García"`, el backend
  utiliza `0.0`.
- Si se informan explícitamente menos de `9.0` horas para un empleado interno, debe
  resolverse el motivo antes de confirmar.
- Si se informan explícitamente menos de `9.0` horas para un empleado externo, se
  registran sin solicitar motivo.

No hace falta modelar un estado conversacional `pendiente_horas_externo`.

### 3.3 `sin_novedades` con novedades ya cargadas

**Resuelto:** si el encargado declara `"todos presentes"` después de registrar novedades,
el agente rechaza la combinación y solicita una aclaración. Conserva todas las novedades
en memoria y no limpia información automáticamente.

Si el encargado desea reemplazar lo cargado por una declaración sin novedades, primero
debe cancelar o eliminar explícitamente las novedades existentes.

### 3.4 Cambio de fecha con un borrador ya cargado

**Resuelto:** las novedades en memoria pueden trasladarse a otra fecha cuando provienen
de un borrador retomado, pero únicamente después de una confirmación explícita del
encargado.

El agente debe informar la fecha original y la nueva fecha propuesta. Solo aplica el
traslado si el encargado responde con el comando completo `CAMBIAR FECHA`. Si responde
`MANTENER FECHA`, descarta la propuesta y conserva el borrador cargado. El borrador
original no se modifica en DB durante el traslado; cualquier cambio se persiste recién al
confirmar el parte de la fecha de destino.

### 3.5 Idempotencia de confirmaciones sucesivas

**Resuelto:** la deduplicación durable del webhook y la idempotencia por
`crm_mensaje.id` se resuelven en la capa común de recepción antes de derivar el turno al
agente. Un retry técnico de una confirmación vieja no vuelve a ejecutar
`ParteDiarioService`.

La cabecera conserva el último `mensaje_origen_id` únicamente como trazabilidad básica.
No se requiere una tabla adicional ni una constraint única sobre ese campo para
implementar v1. Un historial completo de actualizaciones del parte puede incorporarse
como auditoría funcional en una etapa posterior, pero queda fuera del alcance de este
plan.

## 4. Modelos, tablas y datos

Esta sección describe exclusivamente cambios persistentes. No incluye comportamiento
conversacional.

### 4.1 Modelos existentes a consolidar

#### `ParteDiario`

Mantener la cabecera del parte y consolidar:

| Campo o regla | Objetivo |
|---------------|----------|
| `estado="borrador"` | Parte editable generado por el agente |
| `estado="cerrado"` | Parte cerrado desde backoffice; solo lectura para el agente |
| `mensaje_origen_id` | Referencia al último mensaje que confirmó o actualizó el parte |
| `UNIQUE (idproyecto, fecha)` | Máximo un parte por proyecto y día |

#### `ParteDiarioDetalle`

Consolidar:

| Campo o regla | Objetivo |
|---------------|----------|
| `idestado` nullable | Estado del empleado; puede ser `None` para externos |
| `ingreso`, `egreso` nullable | Horarios opcionales |
| `origen="agente"` | Novedad explícitamente informada por el encargado |
| `origen="default"` | Presente implícito generado al confirmar |
| `UNIQUE (parte_diario_id, idnomina)` | Una única fila por empleado dentro del parte |

#### `ParteDiarioEstado`

Mantener el catálogo administrable:

| Campo | Objetivo |
|-------|----------|
| `abreviatura` única | Código estable utilizado por backend y LLM |
| `nombre` | Texto visible para el encargado |
| `activo` | Permite ocultar opciones sin eliminar datos históricos |

#### `Nomina`

Verificar que los datos necesarios para resolución estén disponibles:

- Proyecto asignado.
- Estado activo.
- Fecha de egreso, si aplica.
- Nombre completo utilizable para matching.
- Número de legajo, si corresponde mostrarlo para desambiguar.

### 4.2 Migraciones ya preparadas a revisar

Revisar, ajustar si corresponde y aplicar en orden:

1. `20260530_add_fecha_egreso_nro_legajo_to_nominas.py`
2. `20260530_parte_diario_estados.py`
3. `20260530_add_ingreso_egreso_partes_diario_detalles.py`
4. `20260530_add_mensaje_origen_origen_detalle_partes_diario.py`
5. `20260530_rename_pendiente_to_borrador_partes_diario.py`
6. `20260531_add_parte_diario_invariants.py`
7. `20260531_add_channel_inbound_dedup_invariants.py`
8. `20260601_add_agent_turn_lease.py`

Estas migraciones están aplicadas en Neon de test y preparan las columnas, tablas e
invariantes persistentes requeridas.

### 4.3 Migraciones adicionales requeridas

La migración `20260531_add_parte_diario_invariants.py` agrega:

- Agregar `UNIQUE (idproyecto, fecha)` en `partes_diario`.
- Agregar `UNIQUE (parte_diario_id, idnomina)` en `partes_diario_detalles`.

No agregar `UNIQUE (mensaje_origen_id)` ni una tabla de materializaciones dentro de este
alcance. La prevención de retries se implementa en el runtime común según §3.5.

### 4.4 Auditoría y saneamiento previo

Antes de aplicar constraints en ambientes con datos existentes:

1. Detectar partes duplicados por `(idproyecto, fecha)`.
2. Detectar detalles duplicados por `(parte_diario_id, idnomina)`.
3. Verificar valores históricos de `estado` y migrar `pendiente` a `borrador`.
4. Completar `origen="agente"` en detalles existentes.
5. Verificar detalles con `horas` nulas o fuera de rango.
6. Verificar referencias inválidas a nómina o estados.
7. Verificar si `parte_diario_estados` está poblada en cada ambiente.

Los duplicados existentes deben resolverse con un script de saneamiento revisado antes de
activar las constraints. No deben descartarse datos automáticamente desde la migración.

### 4.5 Inicialización y administración del catálogo

Ejecutar `python scripts/seed_parte_diario_estados.py` para inicializar los estados
requeridos por el despliegue:

- Inserta estados faltantes.
- Preserva nombres, flags `activo` y abreviaturas existentes administrados desde la tabla.
- Puede ejecutarse nuevamente sin duplicar filas.

Luego de la inicialización, `parte_diario_estados` continúa siendo un catálogo
administrable. El runtime consulta sus registros activos; no utiliza el seed ni una lista
hardcodeada como fuente operativa. El contenido de la tabla debe verificarse en
desarrollo, staging y producción antes de habilitar `parte_diario`.

### 4.6 Materialización del parte diario

Crear `ParteDiarioService.create_or_update_from_agent_message(session, mensaje_id)` con
transacción única:

1. Recibir únicamente un `mensaje_id` ya deduplicado por el runtime común.
2. Validar payload completo y sin ambigüedades.
3. Para un parte nuevo, insertar cabecera en estado `borrador`.
4. Para un borrador retomado, revalidar que continúe en estado `borrador`.
5. En actualización, conservar la cabecera y eliminar todos sus detalles anteriores.
6. Insertar nuevamente las novedades explícitas con `origen="agente"`.
7. Regenerar presentes implícitos con `origen="default"`.
8. Actualizar trazabilidad y commit.

Para los detalles, actualizar equivale a `DELETE + INSERT`. No se realiza merge parcial
de filas persistidas.

## 5. Runtime común

Esta etapa implementa o verifica garantías transversales antes de delegar al agente.

### 5.1 Recepción del mensaje

Verificar que la capa común:

- Valide autenticidad y estructura mínima del webhook.
- Deduzca el encargado y la única oportunidad activa a partir del teléfono.
- Rechace teléfonos no autorizados o proyectos inactivos.
- Deduplicar eventos por identificador externo de Meta (`wamid` o equivalente).
- Persista el mensaje antes de iniciar su procesamiento.

### 5.2 Procesamiento secuencial

Implementar o verificar una cola o lock durable por `oportunidad_id`:

- Un único turno activo por oportunidad.
- Mensajes posteriores pendientes hasta finalizar el anterior.
- Orden de llegada preservado.
- Funcionamiento correcto con múltiples workers y reinicios.

Esta garantía no se implementa dentro de `pedido_obra` ni `parte_diario`.

### 5.3 Idempotencia técnica

Antes de ejecutar un turno:

- Consultar si `crm_mensaje.id` ya tiene resultado final persistido.
- Reutilizar el resultado existente sin volver a invocar al LLM ni al sub-proceso.

### 5.4 Delivery durable

Antes de llamar a WhatsApp:

- Registrar el delivery pendiente.
- Actualizarlo a `sent` o `failed`.
- Reintentar fallos sin volver a materializar la operación de negocio.
- No reenviar si existe un `pending` reciente para el mismo mensaje.
- Recuperar un `pending` abandonado después del umbral configurable
  `AGENT_DELIVERY_PENDING_STALE_SECONDS`.
- Aplicar backoff configurable mediante `AGENT_DELIVERY_RETRY_AFTER_SECONDS` antes de
  retries automáticos. El retry manual puede omitir el backoff, pero nunca un `pending`
  todavía activo.
- Si Meta acepta inicialmente el envío pero luego informa `failed` mediante callback,
  propagar el error hacia el inbound que originó la respuesta, conservar el detalle del
  proveedor y reabrir el delivery para retry con backoff.
- No reenviar una respuesta conversacional pendiente si ya existe un inbound posterior
  para la misma oportunidad. Marcarla `superseded`: el contexto avanzó y entregar una
  respuesta vieja produciría mensajes duplicados o fuera de orden.

## 6. Funcionalidad conversacional común

### 6.1 `GeneralProcess`

Crear el proceso general para turnos sin proceso activo:

- Interpretar intención mediante schema estricto.
- Abrir `pedido_obra` o `parte_diario`.
- Responder consultas directas de nómina o parte del día.
- Responder saludos y mensajes ambiguos con menú.
- Reutilizar únicamente una aclaración previa vigente.
- Aplicar activate-and-forward: reenviar el mensaje original al proceso recién abierto.

### 6.2 Orquestador

Modificar `AgentTurnOrchestrator`:

- Si hay proceso activo, delegar directamente a ese proceso.
- Si no hay proceso activo, delegar a `GeneralProcess`.
- Permitir activate-and-forward dentro del mismo turno.
- Cerrar `ConversationState` solo después de materialización exitosa cuando corresponda.
- Conservar state y responder error recuperable si la escritura falla.

### 6.3 Contrato común del LLM

Aplicar en `GeneralProcess`, `pedido_obra` y `parte_diario`:

- JSON Schema estricto.
- Enums cerrados.
- `additionalProperties: false`.
- Respuesta del LLM tratada como input no confiable.
- Validación backend previa a modificar state.
- Manejo recuperable de output inválido o `refusal`.
- Trazas con prompt, modelo, latencia, plan crudo y resultado de validación.

### 6.4 Comandos exactos

Centralizar el criterio:

- Solo el mensaje completo `CONFIRMAR` materializa y cierra.
- Solo el mensaje completo `CANCELAR` descarta el proceso activo.
- Normalizar espacios, mayúsculas y tildes.
- No utilizar substring matching.
- Frases informales solo llevan al resumen o solicitan el comando explícito.

## 7. Ajustes funcionales de `pedido_obra`

Mantener la experiencia actual y limitar el cambio a:

1. Adaptar el proceso a la regla de proceso único.
2. Reservar persistencia y cancelación para `CONFIRMAR` y `CANCELAR` exactos.
3. Agregar `request_other_process` para bloquear intentos de iniciar un parte diario.
4. Mantener carga incremental, suma de materiales equivalentes y consultas.
5. Mantener cantidades faltantes diferidas hasta cierre.
6. Mantener fast paths numéricos y comandos simples como `"listo"`.
7. Mantener recuperación pasiva del pedido anterior después de 60 minutos.
8. Validar referencias, cantidades positivas y transiciones antes de modificar state.
9. Conservar trazabilidad del último `mensaje_origen_id`; la idempotencia técnica se
   resuelve en el runtime común.

Agregar tests de regresión antes de modificar el handler para demostrar que el flujo
existente continúa funcionando.

## 8. Nuevo proceso `parte_diario`

### 8.1 Componentes

Crear el módulo `backend/agente/v2/processes/parte_diario/` con:

| Componente | Responsabilidad |
|------------|-----------------|
| `models.py` | State conversacional, novedades, pendientes, conflictos y planes |
| `resolver.py` | Resolución local de empleados internos y externos |
| `executor.py` | Aplicación pura y determinística de operaciones |
| `renderer.py` | Textos fijos y resúmenes para WhatsApp |
| `llm_client.py` | Structured Outputs para interpretación del turno y fallback acotado |
| `prompts/interpretar_turno.txt` | Instrucciones del proceso |
| `handler.py` | Coordinación de fast paths, consultas DB, LLM, executor y retorno |

### 8.2 Flujo funcional

Implementar:

- Fecha por defecto igual a hoy en Buenos Aires.
- Fecha explícita interpretada desde el mensaje.
- Retoma de borradores existentes.
- Bloqueo informativo de partes cerrados.
- Registro de novedades de internos y externos.
- Presentes implícitos para internos no mencionados.
- Declaración explícita `sin_novedades`.
- Jornada estándar de 9 horas.
- Horas extra y jornadas parciales.
- Motivo obligatorio para internos con menos de 9 horas.
- Default de `9.0` horas para internos y externos cuando no se informan horas ni una
  ausencia explícita.
- Jornadas externas menores a `9.0` horas sin consulta de motivo.
- Una única novedad explícita por persona.

### 8.3 Ambigüedades y conflictos

Implementar resolución diferida:

- Acumular ambigüedades y conflictos durante la carga sin interrumpir al encargado.
- Ignorar como repetición sin efecto una novedad semánticamente idéntica ya cargada.
- Eliminar al retomar una sesión los conflictos redundantes con opciones idénticas.
- Resolver nombre antes que estado.
- Mostrar siempre opciones de estados activas.
- Resolver respuestas simples localmente.
- Usar fallback LLM acotado solo cuando la respuesta no pertenece directamente al dominio.
- Exigir opción numérica después de dos intentos fallidos.
- Resolver conflictos por empleado mediante selección explícita al recibir `CONFIRMAR`,
  sin precedencia automática.

### 8.4 Materialización

Integrar el service de §4.6:

- `parte_listo=True` solo después de `CONFIRMAR`.
- Insert o actualización transaccional del borrador.
- Reemplazo completo de detalles en cada actualización.
- Revalidación de invariantes antes de escribir.
- Cierre conversacional únicamente después del commit.

## 9. Integración con canal y servicios

Modificar la integración existente:

- Construir el orquestador completo desde un único punto de dependencias.
- Reemplazar la inicialización exclusiva de `pedido_obra`.
- Invocar materialización de pedido o parte según el payload.
- Persistir traza por turno.
- Separar materialización de negocio y delivery.
- Mantener endpoint de reproceso manual usando la misma construcción de dependencias.

## 10. Estrategia de tests

### 10.1 Datos y migraciones

- Aplicar upgrade y downgrade en DB de prueba.
- Verificar seed idempotente.
- Verificar saneamiento previo y rechazo controlado ante duplicados.
- Verificar constraints nuevas.

### 10.2 Runtime común

- Webhook duplicado.
- Retry del mismo `crm_mensaje.id`.
- Dos mensajes consecutivos para la misma oportunidad.
- Dos workers intentando procesar la misma oportunidad.
- Commit exitoso con delivery fallido y retry sin rematerialización.

### 10.3 `pedido_obra`

- Suite actual completa.
- Confirmación exacta: `CONFIRMAR`.
- Respuestas informales que no persisten.
- Cancelación exacta: `CANCELAR`.
- Cantidades faltantes.
- Pedido anterior abandonado.
- Intento de iniciar parte diario con pedido abierto.

### 10.4 `parte_diario`

- Todos presentes.
- Novedades múltiples en un mensaje.
- Ausencia, horas extra y jornada parcial.
- Externo con y sin horas.
- Fecha de hoy, fecha anterior y fecha futura.
- Borrador retomado.
- Borrador corregido con reemplazo completo de detalles.
- Parte cerrado desde backoffice.
- Nombre ambiguo.
- Estado ambiguo con resolución local y fallback LLM.
- Dos novedades candidatas para la misma persona.
- `CONFIRMAR` y `CANCELAR` exactos.

### 10.5 Evals del LLM

Crear dataset versionado con mensajes reales anonimizados y casos sintéticos:

- Intención general.
- Operaciones de pedido.
- Extracción de novedades.
- Identificación de conflicto entre procesos.
- Interpretación acotada de estados pendientes.

## 11. Orden recomendado de ejecución

| Fase | Resultado verificable |
|------|-----------------------|
| 0. Verificar decisiones de §3 | Completado: reglas de dominio documentadas |
| 1. Auditar y sanear datos | Completado en Neon test: DB preparada para constraints |
| 2. Completar migraciones y seed | Completado en Neon test: modelos persistentes consistentes |
| 3. Garantizar runtime común | Completado: procesamiento secuencial, idempotente y delivery durable |
| 4. Incorporar `GeneralProcess` y adaptar orquestador | Completado: routing general y proceso único operativos |
| 5. Ajustar `pedido_obra` con regresión cubierta | Completado: flujo existente preservado |
| 6. Implementar núcleo puro de `parte_diario` | Completado: executor y resolver cubiertos por unit tests |
| 7. Implementar handler, LLM y renderers de `parte_diario` | Completado: flujo conversacional implementado |
| 8. Integrar materialización e infraestructura de canal | Completado: commit previo al delivery verificado por integración |
| 9. Ejecutar tests integrales y evals | En curso: regresión focal verde; deuda histórica documentada; evals y smoke tests pendientes |
| 10. Desplegar gradualmente | Monitoreo y rollback disponibles |

## 12. Despliegue

Realizar rollout gradual:

1. Aplicar auditoría y migraciones con backup previo.
2. Verificar catálogo de estados y constraints.
3. Desplegar código con `parte_diario` deshabilitado mediante feature flag.
4. Ejecutar smoke tests de `pedido_obra`.
5. Habilitar `GeneralProcess` y verificar routing.
6. Habilitar `parte_diario` para usuarios de prueba.
7. Revisar trazas, errores recuperables y tiempos de respuesta.
8. Ampliar habilitación progresivamente.

El rollback funcional debe poder deshabilitar `parte_diario` y volver a enrutar únicamente
a `pedido_obra` sin revertir datos ya persistidos.

## 13. Criterios de finalización

La implementación se considera completa cuando:

- Las decisiones funcionales de §3 están documentadas.
- Las migraciones y seeds son reproducibles e idempotentes.
- Las constraints de dominio están activas.
- El runtime garantiza serialización, deduplicación y retries de delivery.
- `pedido_obra` conserva su comportamiento esperado.
- `parte_diario` cubre internos, externos, borradores, ambigüedades y conflictos.
- Solo `CONFIRMAR` persiste y solo `CANCELAR` descarta procesos.
- Los services revalidan invariantes antes de escribir.
- La suite automatizada, los evals y los smoke tests pasan en staging.
- El despliegue gradual y el rollback fueron verificados.

## 14. Fuera de alcance v1

Se mantienen fuera de alcance:

- Un mismo teléfono gestionando múltiples oportunidades activas.
- Múltiples encargados operando simultáneamente el mismo proyecto.
- Política general de expiración para todos los procesos.
- Cierre administrativo del parte desde WhatsApp.
