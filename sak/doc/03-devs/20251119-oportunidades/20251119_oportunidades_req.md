# Requerimientos - Modulo CRM basico (Core Oportunidades)

> **Referencia:** [README_BACKEND_PATTERNS.md](../README_BACKEND_PATTERNS_v1.md)  
> **Version:** 1.0  
> **Fecha:** 2025-11-19 
> **Autor:** Gustavo  

---

## 0. Alcance y supuestos
- Alcance: gestion de contactos, oportunidades, eventos (interacciones), log de estados, sincronia con propiedades/vacancias.
- Supuestos: catalogos editables via backoffice (tipos de operacion, motivos, condiciones de pago, motivos de perdida), usuarios/roles ya existen, zona horaria unica (UTC-3), multimoneda por oportunidad con moneda default ARS configurable.

## 1. Objetivo
Disponer de un modulo CRM minimo para captar y gestionar oportunidades de alquiler, venta y emprendimientos, cambios de estado, con log completo y sincronizado con vacancias.

## 2. Entidades principales
### 2.1 Contacto
- Campos: nombre completo, telefonos (lista), email, red social/opcional, origen/lead source, responsable (usuario), notas.
- Reglas: deduplicar por telefono/email (coincidencia exacta). Al crear, si hay match se reutiliza. Merge manual posible en futuro (no requerido ahora).

### 2.2 Oportunidad
- Campos: contacto (FK), 
- Tipo de operacion (alquiler/venta/emprendimiento), 
- Emprendimiento (opcional, FK), 
- Propiedad (FK filtrada por tipo/emprendimiento), 
- Fecha creacion, 
- Estado, 
- Fecha estado, 
- Motivo de perdida (catalogo), 
- Precio/monto esperado, 
- Moneda (ARS/USD/EUR, etc.), 
- Condiciones de pago (catalogo), 
- Probabilidad (opcional), 
- Fecha estimada de cierre (opcional), 
- Responsable (usuario), 
- Descripcion/nota de estado.
- Estados permitidos: 1-Abierta, 2-Visita, 3-Cotiza, 4-Reserva, 5-Ganada, 6-Perdida.
- Transiciones validas: Abierta -> Visita/Cotiza/Perdida; Visita -> Cotiza/Perdida; Cotiza -> Reserva/Ganada/Perdida; Reserva -> Ganada/Perdida; Ganada/Perdida son finales (reapertura a Abierta con registro de motivo).
- Reglas de datos por transicion: Perdida requiere motivo; Ganada/Reserva requieren precio y condiciones de pago; siempre registrar descripcion de estado.
- Log de estados: cada cambio registra estado anterior, nuevo estado, usuario, fecha y descripcion.

## 2.3 Moneda y tipos de cambio (core)
- Cada oportunidad guarda su moneda.
- Tabla de cotizaciones: moneda origen, moneda destino (default sistema), tipo de cambio, fecha vigencia; tomar ultima cotizacion efectiva <= fecha de calculo. Si falta cotizacion, marcar monto como N/A.

## 4. Catalogos minimos
- Tipos de operacion: alquiler, venta, emprendimiento.
- Motivos de perdida: configurable; obligatorio al cerrar en Perdida.
- Condiciones de pago: configurable.
- Tipos y motivos de evento: lista editable.
- Origen/lead source: online, referidos, walk-in, campana, otros.


## 6. Datos obligatorios y validaciones
- Contacto: nombre + al menos telefono o email.
- Oportunidad: contacto, tipo de operacion, propiedad (o emprendimiento+propiedad), estado inicial, responsable, moneda.
- Cambio a Perdida requiere motivo; cambio a Ganada/Reserva requiere precio y condiciones de pago.


## 7. No funcional (core)
- Idioma: es-AR; multimoneda por oportunidad; moneda default ARS configurable.
- todos los importes cotizados deben traducirse a USD en función de tabla de conversión por moneda , fecha y tipo de cambio. La fecha de conversión será calculada en funcion de la fecha de referencia de la consulta.
- Sin adjuntos binarios; permitir URL de soporte en notas.
- Timezone fija; sin calendarios ni recordatorios push, solo fecha compromiso en eventos.

