# Requerimientos - Modulo CRM basico (Core Oportunidades)

> **Referencia:** (../README_BACKEND_PATTERNS_v1.md)  
> **Version:** 1.0  
> **Fecha:** 2025-11-23
> **Autor:** Gustavo  

---

## 0. Alcance y supuestos
- Alcance: Manejo de mensajes dentro del modulo CRM. El mensaje es la entidad que representa el intercambio de informacion con los clientes. Pueden ser de entrada o de salida y pueden sincronizarse a traves de diferentes canales, por ejemplo whatsapp, mail, redes sociales u otros.
- Supuestos: ya existe un servicio que se encarga de la sincronizacion, dejando el mensaje de entrada o enviando el mensaje de salida. Esta capa de transporte no forma parte del alcance de este documento.

## 1. Objetivo
Disponer de una entidad mensaje que permita mantener una trazabilidad del intercambio de informacion con los clientes independientemente del canal.  
Mensaje de entrada: el usuario CRM podra decidir el destino que le quiere otorgar al mensaje de entrada (confirmar o descartar). Los mensajes recibidos se transformaran en un evento que a su vez pueden dar inicio a una nueva oportunidad o vincularse a una oportunidad existente cambiando su estado.  
Mensaje de salida: cuando el usuario confirma un evento que contiene una respuesta al cliente, se genera un mensaje de salida que queda pendiente para que el servicio de entrega de mensaje se encargue del envio. Si el envio fue exitoso se marca en su estado, y si tuvo algun problema se identifica el error para que luego el usuario consultando un panel de mensajes con error pueda realizar las gestiones correspondientes.

---

## 2. Actores involucrados
- **Agente CRM:** atiende los mensajes entrantes, los clasifica y desencadena acciones (confirmar, descartar, convertir en evento, crear oportunidad).
- **Supervisor CRM:** monitorea bandejas, revisa descartes, reasigna responsables y gestiona el panel de errores.
- **Servicio de Integracion de Mensajes (SIM):** capa ya existente encargada de traer mensajes al CRM y despachar los mensajes de salida.
- **Cliente/contacto:** origen o destino final del mensaje; debe estar identificado en la base de contactos.

---

## 3. Casos de uso principales
1. **Consultar bandeja:** listar mensajes pendientes filtrando por canal, tipo, estado, responsable o texto libre.
2. **Confirmar mensaje entrante:** validar contenido y ejecutar un flujo guiado (wizard) que cubre como minimo tres pasos:  
   a) **Contacto:** buscar por referencia, elegir uno existente o crear uno nuevo con nombre y datos basicos.  
   b) **Oportunidad:** seleccionar una oportunidad abierta sugerida o marcar la opcion “crear nueva” y completar todos los campos requeridos (tipo, estado, propiedad, monto, responsable, etc.).  
   c) **Respuesta/Eventual salida:** registrar el evento generado, definir la accion a realizar y, si corresponde, preparar el mensaje de salida al cliente.  
   El wizard debe validar cada paso antes de avanzar para garantizar consistencia con los modelos de datos.
3. **Descartar mensaje:** marcar como irrelevante registrando motivo y dejando traza para auditoria.
4. **Responder cliente:** desde un evento se genera un mensaje de salida pendiente de envio en el SIM.
5. **Monitorear envios:** visualizar mensajes de salida y sus estados (`pendiente`, `enviado`, `error`) con posibilidad de reintentar.
6. **Panel de errores:** foco en mensajes con `error_envio`, registrando acciones correctivas o derivando el contacto por otro canal.

---

## 4. Datos principales de la entidad `mensaje`
- `id`
- `tipo`: `entrada` | `salida`.
- `canal`: `whatsapp`, `email`, `red_social`, `otro`.
- `contacto_id` y datos desnormalizados (nombre, telefono).
- `contacto_referencia`: valor externo segun canal (numero de telefono, direccion de correo, handle social). Se utiliza para resolver el contacto durante la confirmacion.
- `contacto_nombre_propuesto`: nombre ingresado por el usuario al crear un nuevo contacto si no se encuentra uno existente.
- `oportunidad_generar` (booleano) para indicar que se debe crear una nueva oportunidad al confirmar cuando no se encuentra una existente.
- `evento_id` (cuando se confirmo y genero evento).
- `estado`:
  - Entradas: `nuevo`, `recibido`, `descartado`.
  - Salidas: `pendiente_envio`, `enviado`, `error_envio`.
- `prioridad`: `alta`, `media`, `baja`.
- `asunto` / `titulo`.
- `contenido` (texto enriquecido o markdown).
- `adjuntos`: lista de archivos.
- `origen_externo_id`: correlacion con el canal.
- `metadata`: JSON con headers, etiqueta del canal, etc.
- `responsable_id`, `creado_por`, `actualizado_por`, `created_at`, `updated_at`.

**Campos requeridos para eventos generados desde un mensaje**
- `tipo_evento_id`
- `descripcion` / nota interna (puede usar contenido del mensaje).
- `fecha_evento` (por defecto la fecha del mensaje, editable).
- `responsable_id`
- `canal` (heredado del mensaje).
- `resultado` / `accion_siguiente`.

**Campos requeridos para oportunidades creadas o vinculadas**
- `contacto_id`
- `propiedad_id` (opcional pero recomendado; puede provenir de sugerencia LLM).
- `tipo_operacion_id`
- `estado` inicial (`nueva` si se crea).
- `monto_estimado` y `moneda_id` cuando corresponda.
- `probabilidad` / `etapa`
- `responsable_id`
- `fuente` (debe indicar que proviene de un mensaje recibido).

---

## 5. Reglas de negocio
1. Todo mensaje de entrada debe pasar a `recibido` o `descartado`; no se permite omitir la clasificacion.
2. Resolucion de contacto al confirmar:
   - El sistema debe buscar contactos por la referencia del canal (`contacto_referencia`).
   - Si no encuentra coincidencias, el usuario puede crear un nuevo contacto cargando nombre y la referencia; esta accion crea el registro en `crm_contactos` antes de continuar.
3. Al confirmar se crea un registro en `crm_eventos` y se guarda `mensaje_id` como referencia junto con el `contacto_id` resuelto.
4. Durante la confirmacion se resuelve la oportunidad:
   - Si el contacto tiene una oportunidad abierta, el sistema propone esa oportunidad automaticamente (el usuario puede cambiarla).
   - Si no existe oportunidad abierta, el usuario puede marcar “crear nueva oportunidad” para generar un registro con estado inicial `nueva`.
5. Integracion opcional con LLM:
   - El backend puede llamar a un servicio LLM que analice el contenido para sugerir propiedad relacionada, tipo de consulta u oportunidad existente.
   - Las sugerencias se muestran como recomendaciones; el usuario debe confirmarlas manualmente.
6. Los descartes requieren `motivo_descartado` y un comentario opcional.
7. Los mensajes de salida se generan desde un evento y quedan `pendiente_envio` hasta que SIM informe resultado.
8. Estados permitidos para salidas:
   - `pendiente_envio` -> `enviado` (cuando SIM confirma).
   - `pendiente_envio` -> `error_envio` (cuando SIM reporta fallo).
   - `error_envio` -> `pendiente_envio` (cuando un agente dispara reintento).
9. La relacion oficial es `mensaje` -> `evento` -> `oportunidad`; el mensaje almacena `evento_id` y desde el evento se llega a la oportunidad. Reportes o filtros por oportunidad deben resolverse via join en lugar de duplicar el `oportunidad_id` en `mensajes`.
10. Cada cambio de estado se registra en historial con usuario y timestamp.
11. Los usuarios necesitan permiso `crm.mensajes.manage`; solo supervisores pueden reabrir descartes o forzar cambios en salidas.

---

## 6. Requisitos de interfaz
- **Bandeja de entrada:** interfaz estilo cliente de correo (panel de lista + panel de detalle), paginada con 10 filas por defecto y mostrando por omision solo los mensajes en estado `nuevo`/`pendiente`. Debe incluir columnas de fecha, contacto, canal, tipo, estado, responsable y resumen, permitiendo expandir registros como en un inbox tradicional. Filtros por rango de fechas, canal, estado, responsable, contacto y texto libre.
- **Detalle de mensaje:** panel lateral o modal con el contenido completo, adjuntos, historial de estados y botones de accion (Confirmar, Descartar, Crear oportunidad, Reintentar). Durante la confirmacion debe mostrar sugerencias de contacto (por referencia del canal o por LLM) y permitir crear un contacto nuevo completando nombre + referencia.
- **Panel de errores:** vista especializada filtrada en `error_envio` que permite reintentar o registrar acciones manuales.
- **Notificaciones:** cuando SIM registra un error debe generarse una notificacion en la UI para el responsable del mensaje.

---

## 7. Integraciones
- **Entrada:** SIM realiza `POST /crm/mensajes/entrada` con `canal`, `contacto_externo_id`, `contenido`, `timestamp` y `origen_externo_id`. El backend resuelve `contacto_id` si existe coincidencia; de lo contrario queda `null` y se requiere asociacion manual.
- **Salida:** CRM expone `GET /crm/mensajes/salida?estado=pendiente_envio` para que SIM obtenga los pendientes y `PATCH /crm/mensajes/{id}` para actualizar estado y `error_detalle`.
- **LLM / analisis semantico:** se provee un endpoint interno que envia el `contenido` a un servicio LLM (propio o externo). Este servicio devuelve sugerencias de contacto, propiedad, oportunidad y resumen semantico. El resultado se almacena como `metadata.llm_suggestions` para que el usuario lo revise durante la confirmacion.

---

## 8. Requisitos no funcionales
- **Auditoria:** cada cambio critico (confirmar, descartar, reintentar) debe escribirse en tabla de log y en el historial del mensaje.
- **Performance:** filtros de la bandeja deben responder en menos de 1s con datasets de hasta 50k registros usando paginacion en servidor.
- **Seguridad:** contenido y adjuntos deben almacenarse cifrados. Los adjuntos pasan por antivirus antes de quedar disponibles.
- **Disponibilidad:** el ingreso de mensajes no debe fallar aunque la integracion de eventos u oportunidades este fuera de servicio; los mensajes se almacenan y se procesan cuando se restablece.

---

## 9. KPIs y monitoreo
- Porcentaje de mensajes recibidos vs descartados por canal.
- Tiempo promedio (en minutos) desde mensaje `nuevo` hasta `recibido`.
- Volumen de mensajes de salida con `error_envio` y tasa de reintento exitoso.
- Oportunidades creadas a partir de mensajes de entrada.

---

## 10. Backlog sugerido
1. CRUD basico de mensajes con bandeja y filtros.
2. Transformacion de mensajes recibidos a eventos.
3. Asociacion manual a oportunidades existentes y creacion rapida de nuevas.
4. Panel de errores para mensajes de salida con reintentos.
5. Dashboards/KPIs para supervisores.
6. Automatizacion futura: integracion con LLM para sugerir contacto, propiedad y oportunidad en base al contenido del mensaje.

---

## 11. Consideraciones de modelo y relaciones
- **Duplicacion de datos:** la entidad `mensaje` solo debe almacenar la informacion necesaria para procesar el contacto/oportunidad (referencias, resumen, adjuntos). Datos completos del evento y de la oportunidad se guardan en sus respectivas tablas; no duplicar campos como montos, estado o responsable mas alla del tracking minimo (ej. `oportunidad_generar`). Si se requiere auditar, usar historiales o snapshots en los modelos destino.
- **Relaciones:** el flujo definitivo es `mensaje recibido -> evento -> oportunidad`. `mensajes` guarda `evento_id`, y desde el evento se llega a la oportunidad ya que `crm_eventos` referencia a `crm_oportunidades`. No es necesario que eventos u oportunidades almacenen `mensaje_id`; las trazas se obtienen recorriendo la relacion en un unico sentido (mensaje -> evento -> oportunidad). Reportes que comiencen desde eventos pueden resolver el mensaje asociado consultando `eventos.evento_id` en `mensajes`.
