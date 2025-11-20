# Requerimientos - Modulo CRM basico (Core Oportunidades)

> **Referencia:** [README_BACKEND_PATTERNS.md](../README_BACKEND_PATTERNS_v1.md)  
> **Version:** 1.0  
> **Fecha:** 2025-11-18  
> **Autor:** Gustavo  

---

## 0. Alcance y supuestos
- Alcance: gestion de contactos, oportunidades, eventos (interacciones), log de estados, sincronia con propiedades/vacancias.
- No alcance: dashboard comercial (ver documento `20251118_oportunidades_req_dashboard.md`), motor de mailing/whatsapp, automatizaciones complejas, integraciones externas (se dejan hooks), adjuntos pesados (solo metadatos/URL).
- Supuestos: catalogos editables via backoffice (tipos de operacion, motivos, condiciones de pago, motivos de perdida), usuarios/roles ya existen, zona horaria unica (UTC-3), multimoneda por oportunidad con moneda default ARS configurable.

## 1. Objetivo
Disponer de un modulo CRM minimo para captar y gestionar oportunidades de alquiler, venta y emprendimientos, trazando interacciones (eventos) y cambios de estado, con log completo y sincronizado con vacancias.

## 2. Entidades principales
### 2.1 Contacto
- Campos: nombre completo, telefonos (lista), email, red social/opcional, origen/lead source, responsable (usuario), notas.
- Reglas: deduplicar por telefono/email (coincidencia exacta). Al crear, si hay match se reutiliza. Merge manual posible en futuro (no requerido ahora).

### 2.2 Oportunidad
- Campos: contacto (FK), tipo de operacion (alquiler/venta/emprendimiento), emprendimiento (opcional, FK), propiedad (FK filtrada por tipo/emprendimiento), fecha creacion, estado, fecha estado, motivo de perdida (catalogo), precio/monto esperado, moneda (ARS/USD/EUR, etc.), condiciones de pago (catalogo), probabilidad (opcional), fecha estimada de cierre (opcional), responsable (usuario), descripcion/nota de estado.
- Estados permitidos: 1-Abierta, 2-Visita, 3-Cotiza, 4-Reserva, 5-Ganada, 6-Perdida.
- Transiciones validas: Abierta -> Visita/Cotiza/Perdida; Visita -> Cotiza/Perdida; Cotiza -> Reserva/Ganada/Perdida; Reserva -> Ganada/Perdida; Ganada/Perdida son finales (reapertura a Abierta con registro de motivo).
- Reglas de datos por transicion: Perdida requiere motivo; Ganada/Reserva requieren precio y condiciones de pago; siempre registrar descripcion de estado.
- Log de estados: cada cambio registra estado anterior, nuevo estado, usuario, fecha y descripcion.

### 2.3 Evento (interaccion)
- Campos: contacto (FK), tipo (presencial/whatsapp/llamado/mail/redes), motivo (consulta/oferta/visita/otros), fecha del evento, descripcion, asignado a (usuario), oportunidad (FK opcional), origen de lead (catalogo), proximo paso/fecha compromiso (opcional), estado del evento (pendiente/hecho).
- Usos: crear oportunidad y contacto automaticamente si no existen; vincular a oportunidad para reflejar cambios de estado (validando la transicion).
- Timeline: eventos listados cronologicamente en la ficha de contacto y de oportunidad.

## 3. Flujos clave
- Crear evento independiente: buscar/contactar deduplicando; crear contacto si no existe; crear oportunidad en estado Abierta si no hay vinculacion, con datos minimos (tipo, propiedad/emprendimiento); log inicial.
- Crear evento desde oportunidad: ya viene vinculada; si trae estado nuevo, validar transicion y registrar log.
- Sincronia con vacancias/propiedades:
  - Alquiler: propiedad debe estar Disponible al abrir; al ganar pasa a Alquilada y registra vacancia.
  - Venta/emprendimiento: propiedad inicia en Recibida y genera vacancia; al ganar pasa a Vendida. Si hay multiples oportunidades sobre la misma propiedad, solo la primera Ganada cambia a Vendida; las demas se fuerzan a Perdida con motivo "ya vendida/alquilada".

## 3.1 Moneda y tipos de cambio (core)
- Cada oportunidad guarda su moneda.
- Tabla de cotizaciones: moneda origen, moneda destino (default sistema), tipo de cambio, fecha vigencia; tomar ultima cotizacion efectiva <= fecha de calculo. Si falta cotizacion, marcar monto como N/A.

## 4. Catalogos minimos
- Tipos de operacion: alquiler, venta, emprendimiento.
- Motivos de perdida: configurable; obligatorio al cerrar en Perdida.
- Condiciones de pago: configurable.
- Tipos y motivos de evento: lista editable.
- Origen/lead source: online, referidos, walk-in, campana, otros.

## 5. Seguridad y auditoria
- Roles: rol comercial crea/edita oportunidades y eventos; rol supervisor reasigna responsable y reabre oportunidades; otros roles solo lectura.
- Auditoria: usuario/timestamp en creacion y actualizacion de contacto, oportunidad y evento; log de estados como trazabilidad.

## 6. Datos obligatorios y validaciones
- Contacto: nombre + al menos telefono o email.
- Oportunidad: contacto, tipo de operacion, propiedad (o emprendimiento+propiedad), estado inicial, responsable, moneda.
- Cambio a Perdida requiere motivo; cambio a Ganada/Reserva requiere precio y condiciones de pago.
- Evento: fecha, tipo, motivo, descripcion breve, contacto; si crea oportunidad, tambien tipo de operacion.

## 7. No funcional (core)
- Idioma: es-AR; multimoneda por oportunidad; moneda default ARS configurable.
- Sin adjuntos binarios; permitir URL de soporte en notas.
- Timezone fija; sin calendarios ni recordatorios push, solo fecha compromiso en eventos.

