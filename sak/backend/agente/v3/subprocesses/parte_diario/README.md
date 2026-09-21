# parteDiario v3

Guia del patron vigente y mapa para ubicar cambios. Los criterios y procedimientos
de verificacion estan en [PRUEBAS.md](PRUEBAS.md). Un cambio funcional no autoriza
alterar la arquitectura: cualquier cambio de patron debe acordarse y documentarse.

## Arquitectura

| Componente | Responsabilidad | Ubicacion |
| --- | --- | --- |
| Orquestador | Recuperar/crear contexto, elegir subproceso y encolar respuestas. | [orchestrator/service.py](../../orchestrator/service.py) |
| Subproceso / handler | Reconstruir estado, atender comandos comunes, despachar por etapa y devolver resultado. | [handler.py](handler.py) |
| Flows | Gestionar preguntas, comandos locales, selecciones y transiciones de estados relacionados. | `flows/` |
| Domain | Reunir acceso a datos y reglas por entidad, reutilizando servicios del backend. | `domain/` |

El handler recibe `V3InboundMessage` y `V3ConversationContext`; no recibe webhooks.
Devuelve `V3ProcessResult` con respuesta y contexto actualizado al orquestador.
Las transiciones sin pregunta pueden continuar en el mismo turno; una respuesta
detiene el procesamiento. No reinterpretar el texto ya consumido en la nueva etapa.
Un cambio de subproceso se solicita al orquestador, no se llama a otro handler.

### Donde ubicar cada funcion

| Ubicacion | Contenido |
| --- | --- |
| `domain/parte_diario.py` | Recuperacion, fechas disponibles, consultas y persistencia de partes; incluye `ParteDiarioQueryService`. |
| `domain/novedades.py` | Operaciones normalizadas, novedades, horas, pendientes y conflictos del borrador. |
| `domain/empleados.py` | Nomina y resolucion de personas; carga exclusivamente desde la tarja vigente de obra/encargado. |
| `domain/obras.py`, `domain/encargados.py` | Resolucion de obra y encargado de destino. |
| `domain/models.py` | Entidades serializables y `ParteDiarioDraft`. |
| `models.py` / `state.py` | Contratos de operaciones/resultados / contexto conversacional y menus. |
| `adapters/` y `prompts/` | Integraciones, instrucciones y contratos LLM especificos de parte diario. |
| `utils/` | Texto, calendario, normalizacion y renderer sin acceso a DB. |

Los clientes de Chat Completions y Agents SDK en `agente/v3/llm/` son generales.
Los adapters de parte diario les agregan contexto, prompts y herramientas propias.
Chat Completions interpreta novedades y motivos; Agents SDK atiende aclaraciones
de persona y consultas con herramientas. Cada flow puede elegir su mecanismo;
no es obligatorio un prompt por flow ni usar el SDK para mantener un dialogo.
WhatsApp y outbox son generales; `adapters/whatsapp.py` solo reexporta componentes.

## Despacho y estados

```text
Comando comun -> si no coincide, match etapa -> comando local -> LLM si corresponde
```

`state.etapa` es el unico selector del procesador. No agregar `esperando` ni flags
de despacho paralelos. Los campos de origen solo indican donde regresar.
El despacho no repara estados inspeccionando el borrador; cada flow deja la etapa
correcta. Una recuperacion de datos inconsistentes, si se requiere, va al inicio.

| Estado | Responsable |
| --- | --- |
| `inicial`, `seleccionar_accion`, `seleccionar_obra` | `flows/entrada.py` presenta el menu y el handler resuelve la obra elegida. |
| `cargar_fecha`, `seleccionar_fecha`, `pendientes` | `flows/fecha.py` |
| `carga` / `listado` | `flows/carga.py` / `flows/listado.py` |
| `carga_aclaracion` | `flows/aclaracion.py` |
| `carga_validar_empleado`, `carga_validar_obra`, `carga_validar_encargado`, `carga_validar_estado`, `carga_validar_conflicto`, `carga_cambiar_fecha` | `flows/validacion_carga.py` |
| `revision` / `confirmar_salida` / `continuar` | Los modulos del mismo nombre en `flows/`. |
| `finalizado` | El handler limpia `process_state` y vuelve a `general`, sin eliminar la conversacion. Al guardar, la respuesta cierra con resultado, obra y fecha, sin anexar el menu general. |

### Comandos y aclaraciones

- `PARTE DIARIO` sin parametros abre `1: REPORTAR`, `2: PENDIENTES`,
  `3: SALIR`. `REPORTAR` y `PENDIENTES` tambien funcionan como accesos directos;
  una solicitud con obra o fecha explicita conserva la apertura puntual directa.
- `flows/comandos.py` centraliza `nomina`, `ver nomina` y `mostrar nomina`.
  Se atienden antes del match, sin LLM, sin cambiar etapa, borrador ni pagina.
  Si falta obra, se informa sin inferirla. Las consultas de lectura admitidas
  durante validaciones tambien se atienden aqui y vuelven a mostrar la pregunta.
- Cada estado tiene comandos locales propios: `NO` en carga abre revision;
  LISTADO admite `SIGUIENTE` o el numero correlativo de la pagina siguiente y
  `FINALIZAR` o `99`; en confirmar_salida, `NO` cancela el descarte. `SALIR`
  abandona el parte desde cualquier circuito y confirma si hay cambios.
- Una pregunta del interprete o un resultado que requiere corregir/reintentar
  activa `carga_aclaracion`; los pendientes de entidades conservan sus estados
  de validacion especificos. Se conservan
  `aclaracion_pregunta` y `aclaracion_origen` (carga o listado). `SI` y `NO`
  se interpretan con esa pregunta; no ejecutan los comandos locales de carga.
  Si falla la llamada al LLM, tambien se pregunta: no se aplican novedades con
  un interprete alternativo de palabras clave.
- El interprete recibe borrador, catalogo, ultimos 12 intercambios, pregunta
  pendiente y opciones de LISTADO. Una consulta comun no consume la aclaracion.
- Si faltan datos, se mantiene la aclaracion. Si alcanza, se ejecutan las
  operaciones comunes. Rechazar una propuesta devuelve `resume_loading`,
  normalizado como `retomar_carga`: vuelve al origen sin cambios ni revision.
  El contrato LLM solo ofrece ese retorno en `carga_aclaracion`; una solicitud
  nueva en carga/LISTADO requiere operaciones o una pregunta, nunca ese retorno.
- En aclaracion, `VOLVER` termina el loop y vuelve al origen conservando borrador
  y pagina. `SALIR` y `CANCELAR` piden confirmar el descarte; rechazarlo recupera
  la misma pregunta.
- El historial lo mantiene la aplicacion, no una sesion persistente del SDK.
  No reemplazar intenciones libres por listas crecientes de frases.

## Camino comun y negocio

Texto libre y LISTADO convergen en `carga.interpretar_novedades`: interpretacion,
operaciones normalizadas, resolucion y aplicacion al draft. LISTADO solo normaliza
opciones a IDs y navega; no tiene otro clasificador ni ejecutor de novedades.
Los IDs de nomina emitidos por el LLM solo se aceptan cuando estan respaldados por
la normalizacion controlada de LISTADO; en texto libre se descartan y la identidad
se resuelve por nombre contra la nomina vigente.
Las aclaraciones reutilizan ese camino y conservan las referencias numeradas.

Los casos resueltos de un lote se aplican al borrador y los ambiguos quedan en
cola. Se valida empleado, destino y motivo segun corresponda. Una transferencia
pertenece a su operacion, no a todo el mensaje. Obra no identificada requiere menu;
encargado unico se selecciona, varios requieren eleccion. El LLM interpreta;
domain valida datos reales. No anunciar cambios que no se hayan ejecutado.
Los movimientos internos de nomina (`ALT`, `BAJ`, `TRA`) se recuperan separados
del borrador editable: ocupan la unica novedad permitida para ese empleado y parte,
pero no se reenvian al persistir. Si el usuario intenta agregar, modificar o eliminar
otra novedad para esa persona, el agente la rechaza en carga e informa el motivo.

Para cargar empleados, la unica nomina habilitada es `TarjaNomina` de la quincena,
obra y encargado del parte, con `fecha_desde <= fecha_del_parte <= fecha_hasta`.
Texto libre, IDs y LISTADO respetan ese mismo conjunto. No hay fallback a la
asignacion actual ni a otras nominas. Como reparacion defensiva, si falta la tarja
canonica o existe sin ningun `TarjaNomina`, se materializa una unica vez desde la
asignacion base vigente de esa obra y encargado. Una nomina parcial o con registros
eliminados no se completa ni revive automaticamente.
Los menus de personas solo muestran candidatos locales; no existe alta sin validar.
`NO` o `NINGUNO` descartan la novedad pendiente. Las consultas globales son solo
lectura y no habilitan altas. El encargado de origen sigue pudiendo informar que
su empleado trabajo en otra obra; el guardado materializa la novedad en destino.
La opcion manual `Trabajo en` de Parte Diario reutiliza esa materializacion: no
genera `TRA` ni cambia la obra o el encargado de `Nomina`. La interfaz precarga
las horas de la jornada correspondiente y permite indicar las horas trabajadas en
destino. Origen conserva `max(jornada - horas_destino, 0)` y destino recibe las
horas informadas, con la misma distribucion que utiliza el agente. En el detalle
de ambas tarjas se identifica visualmente con el codigo `OTR`; el estado persistido
sigue siendo `P` y no se confunde con el traspaso permanente `TRA`.

LISTADO congela al iniciarse el catalogo completo `numero -> idnomina`; ese orden
se conserva entre paginas, aclaraciones, reanudaciones y cambios posteriores de
la base. La opcion `99` queda reservada para finalizar. Cada pagina muestra ocho
empleados y las novedades acumuladas de paginas anteriores. Un lote valido avanza
una sola pagina despues del ultimo pendiente; `SIGUIENTE` o el numero inicial de
la pagina siguiente avanza sin novedades. `FINALIZAR` o `99`, y completar la ultima
pagina, abren revision directamente. Rechazar o abandonar una aclaracion conserva
la pagina. Las novedades ya cargadas muestran estado, horas, motivo, obra y encargado
de destino cuando correspondan; volver desde revision no oculta esos datos. LISTADO
solo normaliza IDs y reutiliza la interpretacion, validacion y ejecucion de carga.
El motivo especifico prevalece sobre presencia o falta generica, y las horas
explicitas se conservan independientemente del motivo.
Si las horas informadas son menores a la jornada esperada y el motivo sigue siendo
PRESENTE o no fue indicado, el camino comun deja la novedad pendiente y consulta
el motivo antes de registrarla. La regla se aplica por igual a texto libre, LISTADO,
correcciones y trabajo en otra obra; la respuesta conserva las horas informadas.

Solo revision guarda: `1. Guardar`, `2. Volver a carga/listado` segun el origen y
`3. Salir y descartar`. En carga, `GUARDAR`
(tambien `GUARDAR BORRADOR`) deriva a revision y guarda en el mismo turno sin
pregunta intermedia. `NO` presenta el resumen para revisar antes de guardar.
Al confirmar el descarte, la respuesta informa solamente que los cambios no
guardados fueron descartados; finaliza el subflujo sin anexar el menu general.
El modo de apertura define el siguiente paso, no otro mecanismo de guardado.
No hay etapa `cierre`
ni validacion general conversacional posterior. Hoy se guarda BORRADOR, una fecha
anterior CONFIRMADO; no se admiten fechas futuras. Un fallo conserva el borrador.
Un trabajo temporal deja el parte destino en BORRADOR, incluso si estaba CONFIRMADO,
conservando las otras novedades. Un destino CERRADO impide el guardado. Origen y
destino se guardan juntos, sin confirmar transacciones intermedias.
La tarja quincenal destino CERRADA tambien bloquea el alta o la eliminacion del
trabajo temporal. Al eliminarlo con la tarja abierta se quitan la novedad y el
detalle de tarja destino, y el parte destino vuelve a BORRADOR sin afectar `Nomina`.
La jornada usa `app.utils.jornada.get_jornada_esperada(fecha_del_parte)`:
lunes a viernes 9h, sabado 6h, domingo 0h. No duplicar defaults.
`modo_apertura` conserva el recorrido elegido, sin reemplazar `etapa`:
- `diario`: iniciado con `REPORTAR`, abre el habil anterior en borrador (vacio si no
  existe, sin declarar todos presentes). Si ya esta confirmado/cerrado, abre hoy.
  Al guardar el anterior, lo confirma y abre hoy automaticamente, sin preguntar.
  Recupera el parte de hoy si existe, sin arrastrar novedades ni menus del anterior.
  Al guardar hoy, queda BORRADOR y finaliza.
- `puntual`: fecha explicita, relativa o elegida en un menu de fechas/pendientes.
  Guarda solo esa fecha y finaliza; no abre hoy automaticamente.

La apertura automatica no cuenta como una fecha solicitada por el usuario.
Al finalizar se vuelve al agente general. `SALIR` no guarda. Descartar no borra
partes persistidos. La caducidad del contexto depende de su fecha real de creacion,
no de la fecha del parte, y pertenece a `orchestrator/context_store.py`.

## Limpieza para repetir pruebas

El script `backend/scripts/reset_parte_diario_tarjas.py` elimina los datos
operativos de partes diarios y tarjas para comenzar una prueba desde cero. Incluye
`partes_diario`, `partes_diario_detalles`, `tarjas`, `tarja_detalles`,
`tarja_nomina` y la tabla legacy `tarja_novedades` si todavia existe. Conserva
nominas, proyectos, encargados, estados y mensajes CRM.

Desde la raiz del proyecto, revisar primero el alcance y las cantidades:

```powershell
python backend/scripts/reset_parte_diario_tarjas.py --dry-run
```

Para ejecutar la limpieza:

```powershell
python backend/scripts/reset_parte_diario_tarjas.py --apply
```

La ejecucion real muestra nuevamente las cantidades y exige escribir `LIMPIAR`.
Se realiza en una unica transaccion, reinicia las identidades y no usa `CASCADE`,
para impedir que se borren tablas ajenas al alcance declarado.

El contexto conversacional v3 se mantiene en memoria y se limpia por separado.
Luego de borrar la base, reiniciar el backend o llamar:

```text
POST /api/agente/v3/inbox/reset
```

## Reglas para cambios

- Mantener el handler como coordinador; no reintroducir `process.py`, mixins
  ni funciones que solo delegan sin aportar una responsabilidad.
- Agrupar domain por entidad, con sus consultas y modificaciones en el mismo
  modulo. No separar por tipo de operacion ni esconder negocio en utils.
- Flows puede administrar sesiones con `app.db.engine`, pero no ejecutar SQL.
  Domain no llama a flows, handler ni LLM; renderer recibe datos precargados.
- Domain puede recibir el estado completo y usar utilidades de presentacion:
  este patron no exige dominio puro ni capas adicionales para descomponer parametros.
- Documentar el objetivo de cada rutina sobre su encabezado; usar regiones
  coherentes en modulos extensos. No agregar carpetas sin necesidad funcional.
- Verificar el camino activo y los retornos antes de terminar. Actualizar esta
  guia si cambia un contrato y aplicar [los criterios de pruebas](PRUEBAS.md).
  Informar lo verificado y sus limites, sin presentar propuestas como implementadas.

`handler_back.py` y `prompts/cierre.txt` son referencias anteriores, no el flujo
activo. No restaurar compatibilidad ni instrucciones historicas de forma incidental.
