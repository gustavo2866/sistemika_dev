# proyecto_encargados_nomina.spec.md
# Spec breve: encargados de proyecto y encargado de nomina
# Fecha: 2026-06-25

## 1. Contexto

Un proyecto puede tener varios encargados habilitados para operar por WhatsApp.
Esos encargados pueden enviar partes diarios y pedidos de materiales.

Ademas, cada empleado de nomina puede reportar a un encargado especifico.

## 2. Modelo propuesto

Agregar dos relaciones:

- `proyecto_encargados`: define que contactos encargados estan habilitados para operar una obra.
- `nominas.encargado_contacto_id`: define a que contacto encargado reporta cada empleado.
- `partes_diario.contacto_id`: identifica el encargado que reporto el parte diario.
- `tarjas.contacto_id`: identifica el encargado que reporto la tarja.

Los encargados siguen siendo registros de `crm_contactos` con tipo `Encargado`.

## 3. Semantica

- `proyecto_encargados` responde: quienes pueden operar un proyecto.
- `nominas.encargado_contacto_id` responde: a quien reporta un empleado.
- `crm_oportunidades.contacto_id` queda como contacto principal/legado de la oportunidad.
- `crm_mensajes.contacto_id` queda como contacto que envio el mensaje.
- `partes_diario.contacto_id` y `tarjas.contacto_id` identifican el encargado que reporto.

Es valido que `crm_mensajes.contacto_id` sea distinto de `crm_oportunidades.contacto_id`.

## 4. Flujo del agente comun

- Paso 1: la `conversation_id` actual es `meta:{account_ref}:{from_phone}`; no requiere cambio.
- Paso 2: la resolucion `from_phone -> crm_contactos.id` no requiere cambio.
- Paso 3: resolver proyectos habilitados desde `proyecto_encargados`.
- Paso 4: la seleccion de obra cuando hay varias opciones no requiere cambio.

## 5. Parte Diario

- Paso 5: la seleccion o inferencia de fecha del parte diario no requiere cambio.
- Paso 6: cargar en la nomina el encargado asignado; mantener la resolucion actual y mostrarlo entre parentesis solo si difiere del contacto que reporta.
- Paso 7: al guardar, mantener `crm_mensajes.contacto_id` como el contacto que reporto.
- El menu de partes reportados debe filtrar por proyecto y por `contacto_id`.

## 6. Pedido Obra

- Usa el flujo comun para resolver el proyecto habilitado.
- El guardado debe mantener `crm_mensajes.contacto_id` como el contacto que reporto.
- El menu de ultimos pedidos debe filtrar por oportunidad/proyecto y por `contacto_id`.

## 7. Resources

- Actualizar resources de `parteDiario`, `pedidoObra` y `tarja` para incluir `contacto_id`.
