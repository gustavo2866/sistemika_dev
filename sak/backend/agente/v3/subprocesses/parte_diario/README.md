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
- `seleccionar_obra`
- `seleccionar_fecha`
- `carga`
- `revision`
- `validacion`
- `cierre`
- `confirmar_salida`
- `finalizado`

Nota de compatibilidad: `cargar_fecha` puede aparecer en conversaciones viejas persistidas, pero ya no es un estado conversacional principal. El handler lo trata como una transicion interna de preparacion de fecha y lo mueve a `carga` o `seleccionar_fecha`.

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

Es el punto de entrada del subproceso. Su responsabilidad principal es resolver la obra asociada al contacto.

Comportamiento:

- Si no hay obra asociada, responde error y pasa a `finalizado`.
- Si hay una sola obra, guarda `contacto_id`, `oportunidad_id`, `proyecto_id` y continua.
- Si hay varias obras, guarda `opciones_obra` y pasa a `seleccionar_obra`.
- Con obra asignada, avanza al flujo de fecha.

Regla importante:

- `inicial` no debe interpretar comandos globales fuera de su contexto.
- La resolucion de fecha pertenece al flujo de `seleccionar_fecha`.
- La carga de novedades pertenece a `carga`.

Transiciones:

- obra resuelta -> `seleccionar_fecha` y preparacion interna de fecha;
- varias obras -> `seleccionar_obra`;
- sin obra -> `finalizado`.

### `seleccionar_obra`

Toma la opcion de obra elegida por el usuario.

Comportamiento:

- Si la opcion es valida, guarda `contacto_id`, `oportunidad_id`, `proyecto_id` y continua.
- Si la opcion es invalida, vuelve a pedir una opcion valida.

Transiciones:

- obra seleccionada -> `seleccionar_fecha` y preparacion interna de fecha;
- opcion invalida -> permanece en `seleccionar_obra`.

### Preparacion interna de fecha

No es un estado conversacional principal. Es el paso interno que se ejecuta desde `seleccionar_fecha` cuando ya hay una fecha definida o cuando el sistema puede asumir una fecha por defecto.

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

- preparacion exitosa -> `carga`;
- fecha no editable o invalida -> `seleccionar_fecha`;
- fecha cerrada/confirmada -> consulta y finaliza.

### `seleccionar_fecha`

Arma el menu de fechas y toma la seleccion del usuario.

Este estado interpreta el mensaje dentro del contexto de fecha: opcion numerica, fecha directa, pedido de menu, consulta de nomina o salida. Cuando obtiene una fecha valida, llama al paso interno de preparacion de fecha.

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

- `sin cargar`: guarda la fecha seleccionada y prepara internamente el parte.
- `borrador`: guarda la fecha seleccionada y prepara internamente el parte.
- `cerrado`: muestra novedades como consulta e informa que no se puede editar.

Transiciones:

- opcion valida editable o sin cargar -> preparacion interna -> `carga`;
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

Durante la carga no se muestra menu de cierre. El agente confirma lo registrado
y pregunta si hay alguna otra novedad.

Comandos locales:

- `NO`, `NADA MAS`, `LISTO`, `OK` o equivalentes: pasa a `revision`.
- `GUARDAR`: guarda el parte como `borrador` por compatibilidad con texto escrito.
- `CERRAR` o `FINALIZAR`: valida pendientes y reglas de cierre por compatibilidad con texto escrito.
- `SALIR`: pasa a `confirmar_salida`.

Regla importante:

No se validan reglas de cierre durante la carga conversacional. Las validaciones
se disparan al finalizar el parte desde `revision` o con el comando textual `CERRAR`.

Transiciones:

- carga normal -> permanece en `carga`;
- fin de carga -> `revision`;
- `GUARDAR` -> `continuar` o `finalizado` con parte `borrador`;
- `CERRAR` sin pendientes -> `continuar` o `finalizado`;
- `CERRAR` con pendientes -> `validacion`;
- `SALIR` -> `confirmar_salida`.

### `revision`

Muestra el resumen final del draft y recien ahi presenta acciones interactivas.
Los botones dejan de ser el mecanismo principal de carga y pasan a ser el
mecanismo de cierre.

Ejemplo:

```text
Resumen del parte
Fecha: 2026-07-17
Obra: Obra Centro

Ausencias
- Perez (Enfermedad)
- Ruiz (Vacaciones)

Horas extra
- Medina (4)

Otra obra
- Vera

Cerrar definitivamente?
SI cierra el parte. NO lo deja pendiente.
```

Comandos locales:

- `SI`: valida reglas de cierre y guarda en DB como confirmado.
- `NO`: guarda en DB como `borrador`.
- `SALIR`: pasa a `confirmar_salida`.

Transiciones:

- `NO` exitoso -> `continuar` o `finalizado`;
- `SI` exitoso -> `continuar` o `finalizado`;
- `SI` con pendientes -> `validacion`;
- salir -> `confirmar_salida`.

### `validacion`

Resuelve las validaciones pendientes antes del cierre.

Casos:

- nombre ambiguo;
- persona no encontrada;
- estado faltante;
- motivo faltante;
- conflicto por persona repetida.

Comportamiento:

- Para personas no encontradas, busca nombres similares durante la carga y tambien antes del cierre.
- Si encuentra similares en la obra actual, presenta solo esos candidatos y agrega `OTROS` si hay coincidencias externas.
- Si el usuario responde `OTROS`, muestra los candidatos externos agrupados por obra con etiqueta corta.
- La respuesta puede ser el nombre de un candidato, `NINGUNO`, `OTROS` cuando se muestra, un nuevo filtro de nombre o directamente una novedad.
- `NINGUNO` registra la novedad sin persona validada.
- Si no hay coincidencias, informa que no encontro a la persona y pide reingresar el nombre, escribir `NINGUNO` o informar una nueva novedad.
- Al resolver un candidato, el resumen usa el nombre completo seleccionado y muestra el legajo si esta disponible.
- Por ahora, lo aceptado sin validar no se registra en DB al confirmar.
- Mientras hay validacion pendiente, el agente de carga interpreta la respuesta y decide si selecciona persona, registra sin validar, pide aclaracion o procesa el texto como nueva novedad.

Ejemplo:

```text
A cual Petro te referis?

Perez Pedro; Perez Pablo; Peretto Juan.

Responde con el nombre, NINGUNO u OTROS.
```

Transiciones:

- validacion resuelta y sin pendientes -> `cierre` con confirmacion `OK` / `VOLVER`;
- quedan pendientes -> permanece en `validacion`;
- seleccion sin validar -> se descarta del registro final por ahora y continua validacion o pasa a `cierre`.

### `cierre`

Estado tecnico usado cuando el parte ya supero validaciones y pide confirmacion
final con `OK` / `VOLVER`.

Si el cierre paso por `validacion`, antes de persistir se muestra el resumen final y se pide confirmacion:

```text
Opciones: OK / VOLVER.
```

- `1` o `OK`: persiste el parte como `cerrado`.
- `2` o `VOLVER`: vuelve a `carga`.

Si por compatibilidad llega un estado `cierre` sin validacion pendiente, el handler
lo trata como `revision`.

### `confirmar_salida`

Pide confirmacion para descartar el parte en carga.

Menu:

```text
Se perderan los cambios no guardados.

Opciones: OK / VOLVER.
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
- si hay varias obras, pasa a `seleccionar_obra`.
- con obra asignada, entra al flujo de `seleccionar_fecha`.
- la preparacion interna de fecha decide la fecha segun el contexto.

Si no hay fecha asignada, la regla de preparacion interna es asumir `hoy`.

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

- Si estaba `sin cargar`, guarda la fecha y prepara internamente el parte.
- Si estaba `borrador`, guarda la fecha y prepara internamente el parte.
- Si estaba `cerrado`, muestra el parte como consulta e informa que no se puede editar.

### Carga

Durante la carga:

```text
Hay alguna otra novedad?
```

- `NO`, `NADA MAS`, `LISTO`, `OK` o equivalentes: pasa a `revision`.
- `GUARDAR`: guarda el borrador por compatibilidad con texto escrito.
- `CERRAR` o `FINALIZAR`: intenta cerrar el parte y ejecuta validaciones.
- `SALIR`: pide confirmacion para descartar.

Si hay validaciones pendientes, `SI` desde `revision` o `CERRAR`
pasa a la etapa `validacion`.

### Revision

```text
Cerrar definitivamente?
SI cierra el parte. NO lo deja pendiente.
```

- `SI`: valida y guarda en DB como confirmado.
- `NO`: guarda en DB como `borrador`.
- `SALIR`: pide confirmacion para descartar.

### Validacion

Durante la validacion se resuelven pendientes antes del cierre:

- nombres ambiguos;
- personas no encontradas;
- estados o motivos faltantes;
- conflictos por novedades repetidas.

La busqueda por nombres similares se ejecuta aca, no durante la carga.

`VOLVER` retorna a `carga` con el resumen del parte y sin menu principal.

Cuando no quedan pendientes, el flujo pasa a `cierre`, muestra el resumen final y pide confirmacion con `OK` / `VOLVER`.

### Cierre

Cuando no hay pendientes, el cierre tecnico pide confirmacion final solo si viene
de una validacion recien resuelta:

Si el cierre viene de una validacion recien resuelta, primero se muestra:

```text
Opciones: OK / VOLVER.
```

- `1` o `OK`: guarda en DB como `cerrado`.
- `2` o `VOLVER`: vuelve a `carga`.

Luego de guardar o cerrar, el flujo continua con la siguiente fecha pendiente o finaliza.

### Confirmar Salida

```text
Opciones: OK / VOLVER.
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
- Preparar internamente la fecha: asumir fecha, consultar parte existente y preparar contexto.
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
