# parteDiario v3

Este documento describe el flujo esperado del subproceso `parteDiario` en agente v3.

## Objetivo

Registrar el parte diario de una obra desde WhatsApp, manteniendo el estado conversacional en v3 y guardando en DB al elegir `GUARDAR` o `CERRAR`.

El parte diario debe contener solo novedades explicitas. Si el usuario informa que no hubo novedades o que todos trabajaron normalmente, se crea el parte sin detalles.

## Entrada al Subproceso

`parteDiario` no recibe webhooks ni mensajes crudos.

La recepcion del mensaje pertenece a las capas de channel/inbox y al orquestador v3:

1. channel normaliza el webhook o mensaje entrante;
2. inbox procesa el `V3InboundMessage`;
3. el orquestador carga contexto y decide el subproceso;
4. si corresponde, el orquestador deriva el mensaje a `ParteDiarioSubprocess.handle(...)`.

El flujo documentado abajo empieza cuando `parteDiario` ya recibio un `V3InboundMessage` derivado por el orquestador.

## Estados del Subproceso

El estado principal se guarda en `ParteDiarioV3State.etapa`.

Estados posibles:

- `inicial`
- `cargar_fecha`
- `seleccionar_fecha`
- `carga`
- `validacion`
- `cierre`
- `confirmar_salida`
- `finalizado`

## Estados de Dominio del Parte

Estos son los estados reales de `ParteDiario.estado` en DB:

- `borrador`: parte editable por el agente.
- `cerrado`: parte cerrado por administracion, solo lectura para el agente.

Valores usados en menues:

- `borrador`: existe `ParteDiario` y se puede editar.
- `cerrado`: existe `ParteDiario` y no se puede editar desde WhatsApp.
- `sin cargar`: no existe `ParteDiario` para esa obra y fecha; no es un estado persistido.

Nota: si en algun flujo aparece el texto `abierto`, debe entenderse como alias visual de `borrador`, no como estado de dominio.

## Patron de Comandos e Inferencia

`parteDiario` sigue el mismo criterio que `pedidoObra`:

- cada `etapa` define primero sus comandos locales aceptados;
- los comandos locales no pasan por LLM;
- si el mensaje no coincide con un comando local de la etapa, se interpreta con LLM;
- el LLM usa un prompt propio segun la etapa conversacional.

Prompts v3:

- `prompts/carga.txt`: interpreta texto libre durante la carga de novedades.
- `prompts/cierre.txt`: interpreta texto libre cuando el parte ya esta para confirmar.
- `prompts/estado_pendiente.txt`: interpreta respuestas de motivo/estado pendiente.

El cliente LLM propio de v3 es `llm_client.py`. El handler le entrega al proceso una instancia configurada para la etapa actual, evitando guardar la etapa como estado mutable compartido del cliente.

Estructura tecnica actual:

- v3 posee handler, estado wrapper, cliente LLM y prompts propios;
- la ejecucion de operaciones vive en `executor.py`;
- la coordinacion conversacional interna vive en `process.py`;
- la resolucion de nomina y estados vive en `resolver.py`;
- las respuestas deterministicas viven en `renderer.py`;
- los modelos serializables del draft viven en `models.py`.

El subproceso `parteDiario` es autocontenido dentro de v3.

## Flujo por Estado

### `inicial`

Es el punto de entrada del subproceso. Evalua la entrada, interpreta el mensaje si corresponde y resuelve la obra asociada al contacto.

Comportamiento:

- Si el mensaje es comando local, ejecuta la accion local que corresponda.
- Si el mensaje es texto libre, llama al LLM v3 de `parteDiario`.
- El LLM puede devolver fecha inferida, novedades y contenido complementario del mensaje.
- Si no hay obra asociada, responde error y pasa a `finalizado`.
- Si hay una sola obra, guarda `contacto_id`, `oportunidad_id`, `proyecto_id` y continua.
- Si hay varias obras, guarda `opciones_obra` y pide seleccion.
- Con obra asignada, hace forward a `cargar_fecha`.

Regla importante:

- `inicial` no aplica fecha.
- `inicial` no consulta partes diarios.
- `inicial` no recupera novedades.
- Toda decision sobre fecha y parte existente pertenece a `cargar_fecha`.

Transiciones:

- obra resuelta -> `cargar_fecha`;
- varias obras -> `inicial` hasta que el usuario elija una;
- sin obra -> `finalizado`.

### `cargar_fecha`

Es el unico estado responsable de preparar el parte para una fecha.

Fuentes posibles de fecha:

- fecha ya guardada en contexto;
- fecha inferida por el LLM;
- fecha seleccionada en `seleccionar_fecha`;
- ausencia de fecha.

Comportamiento:

- Si no hay fecha asignada en contexto, asume `hoy`.
- Con `proyecto_id + fecha`, consulta si existe `ParteDiario`.
- Si no hay parte diario, mantiene el contexto de novedades ya interpretadas y pasa a `carga`.
- Si hay parte diario editable, recupera novedades explicitas al contexto y pasa a `carga`.
- Si hay parte diario no editable, devuelve mensaje indicando que no se puede editar y hace forward a `seleccionar_fecha`.
- Si la fecha detectada cambia respecto de una fecha activa, puede pedir confirmacion antes de aplicar el cambio.

Transiciones:

- sin parte diario -> `carga`;
- parte editable -> `carga`;
- parte no editable -> `seleccionar_fecha`;
- falta fecha y se decide no asumir hoy -> `seleccionar_fecha`.

### `seleccionar_fecha`

Arma el menu de fechas y toma la seleccion del usuario.

Este estado no recupera novedades ni prepara el parte para edicion. Solo obtiene una fecha valida y luego forwardea a `cargar_fecha`.

Ejemplo:

```text
1: 16/05/2026 sab (borrador)
2: 15/05/2026 vie (cerrado)
3: 14/05/2026 jue (sin cargar)
```

Estados de fecha:

- `sin cargar`: no existe parte para esa fecha.
- `borrador`: existe parte editable.
- `cerrado`: existe parte cerrado y no editable desde WhatsApp.

Comportamiento al seleccionar opcion:

- `sin cargar`: guarda la fecha seleccionada y forwardea a `cargar_fecha`.
- `borrador`: guarda la fecha seleccionada y forwardea a `cargar_fecha`.
- `cerrado`: muestra novedades como consulta e informa que no se puede editar.

Transiciones:

- opcion valida editable o sin cargar -> `cargar_fecha`;
- opcion no editable -> permanece en `seleccionar_fecha` o pasa a `finalizado` si es solo consulta;
- opcion invalida -> permanece en `seleccionar_fecha`.

### `carga`

Acumula novedades del parte diario en memoria.

En esta etapa se aceptan mensajes libres como:

```text
Serrano falto, Ruiz enfermo y Vera trabajo 4hs
todos presentes
sin novedades
```

El texto libre debe ser interpretado por el LLM v3 de `parteDiario`.

El LLM puede detectar:

- fecha referida;
- novedades;
- sin novedades;
- consulta;
- correcciones o eliminaciones.

El handler v3 decide como aplicar la fecha detectada:

- si no habia fecha activa, la usa;
- si hay fecha activa distinta, pide confirmacion de cambio;
- si la fecha esta cerrada, bloquea edicion;
- si existe parte en `borrador`, recupera novedades.

Menu:

```text
Opciones: 1:GUARDAR 2:CERRAR 3:SALIR.
```

Comandos locales:

- `1` o `GUARDAR`: guarda el parte como `borrador` y finaliza.
- `2` o `CERRAR`: valida pendientes y reglas de cierre; si todo esta correcto, guarda el parte como `cerrado`.
- `3` o `SALIR`: pasa a `confirmar_salida`.

Regla importante:

No se validan reglas de cierre durante la carga. Las validaciones se disparan con `2:CERRAR`.

Transiciones:

- carga normal -> permanece en `carga`;
- `1:GUARDAR` -> `seleccionar_fecha` con parte `borrador`;
- `2:CERRAR` sin pendientes -> `seleccionar_fecha` con parte `cerrado`;
- `2:CERRAR` con pendientes -> `validacion`;
- `3:SALIR` -> `confirmar_salida`.

### `validacion`

Resuelve las validaciones pendientes antes del cierre.

Casos:

- nombre ambiguo;
- persona no encontrada;
- estado faltante;
- motivo faltante;
- conflicto por persona repetida.

Comportamiento:

- Para personas no encontradas, busca nombres similares recien en esta etapa.
- Si encuentra similares, presenta opciones para seleccionar.
- Agrega una opcion adicional para aceptar el valor informado sin validar.
- Por ahora, lo aceptado sin validar no se registra en DB al confirmar.
- Mientras hay validacion pendiente, las respuestas numericas pertenecen a esa validacion, no al menu general.

Ejemplo:

```text
A cual Petro te referis?
1. Perez, Pedro
2. Registrar como Petro sin validar
```

Transiciones:

- validacion resuelta y sin pendientes -> `cierre`;
- quedan pendientes -> permanece en `validacion`;
- seleccion sin validar -> se descarta del registro final por ahora y continua validacion o pasa a `cierre`.

### `cierre`

Estado tecnico usado cuando el parte ya supero validaciones y vuelve a mostrar el resumen.
El menu visible se mantiene igual que en carga.

Menu:

```text
Opciones: 1:GUARDAR 2:CERRAR 3:SALIR.
```

Comandos locales:

- `1` o `GUARDAR`: persiste el parte como `borrador`.
- `2` o `CERRAR`: valida reglas de cierre y persiste el parte como `cerrado`.
- `3` o `SALIR`: pasa a `confirmar_salida`.

Transiciones:

- guardar exitoso -> `seleccionar_fecha`;
- cerrar exitoso -> `seleccionar_fecha`;
- salir -> `confirmar_salida`.

### `confirmar_salida`

Pide confirmacion para descartar el parte en carga.

Menu:

```text
Se perderan los cambios no guardados.

Opciones: 1:OK 2:VOLVER.
```

Comandos locales:

- `1` o `OK`: descarta el estado en memoria.
- `2` o `VOLVER`: vuelve a `carga`.

Transiciones:

- ok -> `seleccionar_fecha`;
- volver -> `carga`.

### `finalizado`

Estado terminal.

Comportamiento:

- se limpia `active_process`;
- se limpia `process_state`;
- el orquestador guarda el contexto actualizado;
- si hubo respuesta, el orquestador la envia por outbox.

## Comandos Locales

Los comandos locales no pasan por LLM. Los interpreta el handler v3 segun la etapa actual.

### Comando de Inicio

`Parte diario`

Inicia el flujo del subproceso.

Comportamiento esperado:

- `inicial` reconoce el comando.
- `inicial` resuelve la obra.
- con obra asignada, forwardea a `cargar_fecha`.
- `cargar_fecha` decide la fecha segun el contexto.

Si no hay fecha asignada, la regla definida para `cargar_fecha` es asumir `hoy`.

### Menu de Fechas

El menu de fechas pertenece al estado `seleccionar_fecha`.

Se usa cuando el flujo necesita que el usuario elija otra fecha, por ejemplo porque la fecha actual no es editable o porque una accion local pide seleccionar fecha.

```text
1: 16/05/2026 sab (borrador)
2: 15/05/2026 vie (cerrado)
3: 14/05/2026 jue (sin cargar)
```

Estados posibles:

- `borrador`: existe parte editable y se recuperan sus novedades.
- `cerrado`: existe parte cerrado y no se edita desde WhatsApp.
- `sin cargar`: no existe parte para esa fecha.

### Seleccion de Fecha

En etapa `seleccionar_fecha`, un numero selecciona la fecha correspondiente.

Ejemplo:

```text
1
```

Resultado:

- Si estaba `sin cargar`, guarda la fecha y forwardea a `cargar_fecha`.
- Si estaba `borrador`, guarda la fecha y forwardea a `cargar_fecha`.
- Si estaba `cerrado`, muestra el parte como consulta e informa que no se puede editar.

### Carga

Durante la carga:

```text
Opciones: 1:GUARDAR 2:CERRAR 3:SALIR.
```

- `1` o `GUARDAR`: guarda el borrador y finaliza.
- `2` o `CERRAR`: intenta cerrar el parte y ejecuta validaciones.
- `3` o `SALIR`: pide confirmacion para descartar.

Si hay validaciones pendientes, `2:CERRAR` pasa a la etapa `validacion`.

### Validacion

Durante la validacion se resuelven pendientes antes del cierre:

- nombres ambiguos;
- personas no encontradas;
- estados o motivos faltantes;
- conflictos por novedades repetidas.

La busqueda por nombres similares se ejecuta aca, no durante la carga.

Cuando no quedan pendientes, el flujo pasa a `cierre`.

### Cierre

Cuando no hay pendientes, el menu visible sigue siendo el menu principal:

```text
Opciones: 1:GUARDAR 2:CERRAR 3:SALIR.
```

- `1` o `GUARDAR`: guarda en DB como `borrador`.
- `2` o `CERRAR`: guarda en DB como `cerrado`.
- `3` o `SALIR`: pide confirmacion para descartar.

Luego de guardar o cerrar, el flujo vuelve al selector de fechas de `parteDiario`.

### Confirmar Salida

```text
Opciones: 1:OK 2:VOLVER.
```

- `1` o `OK`: descarta el parte en carga y vuelve al selector de fechas de `parteDiario`.
- `2` o `VOLVER`: vuelve a la carga.

## Texto Libre

Los mensajes de contenido se interpretan con el LLM v3 de `parteDiario`.

Ejemplos:

```text
ayer Serrano falto
Ruiz enfermo y Vera trabajo 4hs
hoy todos presentes
mostrame el parte de ayer
```

El LLM debe devolver operaciones estructuradas, incluyendo cuando corresponda:

- fecha referida;
- novedades;
- sin novedades;
- consulta;
- correcciones o eliminaciones.

El LLM detecta la referencia semantica a fecha, pero el handler v3 decide como aplicarla contra estado y DB.

## Regla de Persistencia

El parte diario guardado o cerrado guarda:

- cabecera `ParteDiario`;
- detalles solo para novedades explicitas.

No se generan detalles `DEFAULT` para toda la nomina.

Ejemplos:

- `Serrano falto`: guarda un detalle para Serrano.
- `todos presentes`: guarda el parte sin detalles.
- `sin novedades`: guarda el parte sin detalles.

## Responsabilidades por Modulo

### `handler.py`

- Resolver obra.
- Procesar comandos locales.
- Mostrar menu de fechas.
- Resolver seleccion de fecha.
- Ejecutar `cargar_fecha`: asumir fecha, consultar parte existente y preparar contexto.
- Coordinar carga, cierre, salida y persistencia.

### `process.py`

- Coordinar el draft conversacional interno del parte.
- Cargar estados, nomina y parte existente desde DB.
- Aplicar fechas detectadas o seleccionadas.
- Manejar validaciones pendientes, conflictos y confirmacion exacta.
- Delegar ejecucion de operaciones a `executor.py`.

### `executor.py`

- Ejecutar operaciones estructuradas del LLM o comandos internos.
- Agregar, modificar, eliminar o mostrar novedades.
- Registrar `sin_novedades`.
- Encolar conflictos o validaciones pendientes.

### `resolver.py`

- Resolver personas contra nomina de la obra y nomina completa.
- Resolver codigos de estado.
- Interpretar selecciones locales de persona o motivo.

### `renderer.py`

- Generar respuestas deterministicas del proceso.
- Renderizar resumen, confirmacion, consulta, validaciones y errores.

### `models.py`

- Definir el estado serializable del draft de parte diario.
- Definir operaciones, novedades, pendientes, conflictos y resultado de ejecucion.

### `state.py`

- Serializar estado v3.
- Guardar obra resuelta.
- Guardar etapa.
- Guardar opciones de obra y fecha.
- Guardar el estado conversacional del parte.

### LLM v3 de `parteDiario`

- Vive en `backend/agente/v3/subprocesses/parte_diario/llm_client.py`.
- Carga prompts desde `backend/agente/v3/subprocesses/parte_diario/prompts`.
- Interpretar texto libre.
- Detectar fecha mencionada.
- Extraer novedades.
- Devolver operaciones estructuradas.

### Servicio de Persistencia

- Crear o actualizar `ParteDiario`.
- Reemplazar detalles existentes por novedades explicitas.
- Crear `CRMMensaje` final de confirmacion para trazabilidad.
