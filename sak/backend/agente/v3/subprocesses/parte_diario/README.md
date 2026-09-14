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
| `inicial`, `seleccionar_obra` | `handler._seleccionar_obra` (particularidad actual). |
| `cargar_fecha`, `seleccionar_fecha`, `pendientes` | `flows/fecha.py` |
| `carga` / `listado` | `flows/carga.py` / `flows/listado.py` |
| `carga_aclaracion` | `flows/aclaracion.py` |
| `carga_validar_empleado`, `carga_validar_obra`, `carga_validar_encargado`, `carga_validar_estado`, `carga_validar_conflicto`, `carga_cambiar_fecha` | `flows/validacion_carga.py` |
| `revision` / `confirmar_salida` / `continuar` | Los modulos del mismo nombre en `flows/`. |
| `finalizado` | El handler limpia `process_state` y vuelve a `general`, sin eliminar la conversacion. |

### Comandos y aclaraciones

- `flows/comandos.py` centraliza `nomina`, `ver nomina` y `mostrar nomina`.
  Se atienden antes del match, sin LLM, sin cambiar etapa, borrador ni pagina.
  Si falta obra, se informa sin inferirla. Las consultas de lectura admitidas
  durante validaciones tambien se atienden aqui y vuelven a mostrar la pregunta.
- Cada estado tiene comandos locales propios: `NO` en carga abre revision,
  en LISTADO avanza de pagina y en confirmar_salida cancela el descarte.
  Son comandos del estado, no palabras clave universales.
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
- En aclaracion, `SALIR` (tambien `VOLVER`) termina el loop y vuelve al origen,
  conservando borrador y pagina. No pide descartar. `CANCELAR` sigue siendo el
  pedido explicito de descarte; rechazarlo recupera la misma pregunta.
- El historial lo mantiene la aplicacion, no una sesion persistente del SDK.
  No reemplazar intenciones libres por listas crecientes de frases.

## Camino comun y negocio

Texto libre y LISTADO convergen en `carga.interpretar_novedades`: interpretacion,
operaciones normalizadas, resolucion y aplicacion al draft. LISTADO solo normaliza
opciones a IDs y navega; no tiene otro clasificador ni ejecutor de novedades.
Las aclaraciones reutilizan ese camino y conservan las referencias numeradas.

Los casos resueltos de un lote se aplican al borrador y los ambiguos quedan en
cola. Se valida empleado, destino y motivo segun corresponda. Una transferencia
pertenece a su operacion, no a todo el mensaje. Obra no identificada requiere menu;
encargado unico se selecciona, varios requieren eleccion. El LLM interpreta;
domain valida datos reales. No anunciar cambios que no se hayan ejecutado.

Para cargar empleados, la unica nomina habilitada es `TarjaNomina` de la quincena,
obra y encargado del parte, con `fecha_desde <= fecha_del_parte <= fecha_hasta`.
Texto libre, IDs y LISTADO respetan ese mismo conjunto. No hay fallback a la
asignacion actual ni a otras nominas, aunque falte la tarja o este vacia.
Los menus de personas solo muestran candidatos locales; no existe alta sin validar.
`NO` o `NINGUNO` descartan la novedad pendiente. Las consultas globales son solo
lectura y no habilitan altas. El encargado de origen sigue pudiendo informar que
su empleado trabajo en otra obra; el guardado materializa la novedad en destino.

Al completar novedades de LISTADO se avanza una sola pagina, despues del ultimo
pendiente; al terminar la ultima se vuelve a carga. Rechazar o abandonar una
aclaracion conserva la pagina. El motivo especifico prevalece sobre presencia o
falta generica, y las horas explicitas se conservan independientemente del motivo.

Solo revision guarda: `1. Guardar`, `2. Volver a carga`. En carga, `GUARDAR`
(tambien `GUARDAR BORRADOR`) deriva a revision y guarda en el mismo turno sin
pregunta intermedia. `NO` presenta el resumen para revisar antes de guardar.
El modo de apertura define el siguiente paso, no otro mecanismo de guardado.
No hay etapa `cierre`
ni validacion general conversacional posterior. Hoy se guarda BORRADOR, una fecha
anterior CONFIRMADO; no se admiten fechas futuras. Un fallo conserva el borrador.
Una transferencia deja el parte destino en BORRADOR, incluso si estaba CONFIRMADO,
conservando las otras novedades. Un destino CERRADO impide el guardado. Origen y
destino se guardan juntos, sin confirmar transacciones intermedias.
La jornada usa `app.utils.jornada.get_jornada_esperada(fecha_del_parte)`:
lunes a viernes 9h, sabado 6h, domingo 0h. No duplicar defaults.
`modo_apertura` conserva el recorrido elegido, sin reemplazar `etapa`:
- `diario`: sin fecha indicada, abre el habil anterior en borrador (vacio si no
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
