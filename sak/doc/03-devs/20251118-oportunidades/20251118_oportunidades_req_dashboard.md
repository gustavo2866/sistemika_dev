# Requerimientos - Dashboard comercial (Oportunidades)

> **Referencia:** [README_BACKEND_PATTERNS.md](../README_BACKEND_PATTERNS_v1.md)  
> **Version:** 1.0  
> **Fecha:** 2025-11-18  
> **Autor:** Gustavo  

---

## 0. Alcance y supuestos
- Alcance: visualizacion y filtros del dashboard comercial basado en oportunidades y propiedades; seleccion de moneda de visualizacion; paginacion de listas.
- No alcance: modelado de contactos/oportunidades/eventos (ver `20251118_oportunidades_req_core.md`), motores de notificaciones o tareas.
- Supuestos: calculos y agregados se resuelven en backoffice (misma logica que dashboard de vacancias); el frontend solo presenta datos ya procesados.

## 1. Objetivo
Proveer un dashboard simple para seguimiento comercial, con KPIs, embudo y listas filtrables, soportando conversion de montos a la moneda elegida por el usuario.

## 2. Entradas de datos
- Periodo: fecha desde/hasta o ultimos 7/30/90 dias.
- Filtros: tipo de operacion, tipo de propiedad, emprendimiento, propietario, responsable.
- Moneda de visualizacion: selector de moneda; default configurable a nivel sistema (default ARS).
- Tabla de cotizaciones: moneda origen, moneda destino (default), tipo de cambio, fecha vigencia; usar la ultima cotizacion efectiva <= fecha de calculo. Si no hay cotizacion, el monto se marca N/A.

## 3. Indicadores y vistas
- KPIs por tipo de operacion: propiedades disponibles; ingresadas en periodo; cerradas (vendidas/alquiladas) en periodo; monto de ventas; rentabilidad usando costo de propiedad (si falta costo, mostrar N/A).
- Embudo de oportunidades por estado: conteo y % conversion; mostrar variacion vs. periodo anterior.
- Lista/drill-down de oportunidades y propiedades filtradas: incluye moneda original y monto convertido a la moneda de visualizacion; paginacion en backend para evitar demoras.
- Dashboard de vacancia: aplica filtro fijo de tipo de operacion alquiler (alineado con comportamiento actual).

## 4. Reglas de conversion de moneda
- Cada oportunidad se almacena en su moneda original.
- El backend convierte montos a la moneda seleccionada usando la tabla de cotizaciones; redondeo a 2 decimales.
- Si falta cotizacion aplicable, marcar el monto como N/A y no sumar en totales; mostrar contador de registros sin conversion (para control).

## 5. No funcional
- Calculos en backoffice; frontend sin logica de negocio.
- Respuestas paginadas para listas; KPIs y embudo agregados listos para mostrar.
- Idioma: es-AR. Timezone fija (UTC-3).
