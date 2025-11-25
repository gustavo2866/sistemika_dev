# Requerimientos - Modulo CRM basico (Core Oportunidades)

> **Referencia:** (../README_BACKEND_PATTERNS_v1.md)  
> **Version:** 1.0  
> **Fecha:** 2025-11-24
> **Autor:** Gustavo  

---

## 0. Alcance y supuestos
- Alcance: Dashboard de indicadores vinculados al manejo de las oportunidades en el CRM.
- Supuestos: Tomar como patron dashboard_vacancias. Cuenta con filtros y tarjetas de indicadores en la cabecera. En el cuerpo se muestran graficos y una lista de oportunidades que responden al contenido de cada tarjeta.
El backoffice cuenta con un metodo que recibe los parametros de filtro y devuelve los indicadores calculados, y otro metodo con los mismos parámetros de filtro mas el indicador y devuelve el detalle de items que componen dicho indicador.

## 1. Objetivo
Disponer de un dashboard que muestre los indicadores pincipales del negocio y al mismo tiempo permita consultar la lista de items, en este caso oportunidades que componen cada indicador.
Filtros:
- periodo: rango de fechas. reutilizar el componente usado en dashborad_vacancia
- tipo de operacion: venta, alquiler, emprendimiento
- tipo de propiedad: 
Indicadores
- Totales  : 
    + oportunidades del periodo. Se deben tomar a+b+c : 
      a- opotunidades que se cerraron dentro del periodo
      b- oportunidades que se crearon con fecha anterior al cierre de periodo y cuya fecha de cierre es posterior al periodo
      c- oportunidades que se crearon con fecha anterior al cierre de periodo y aún no se cerraron
    + indicar cantidad y monto (tomando de referencia el valor de las propiedades)
- Nuevas  : 
    + oportunidades creadas en el periodo. 
    + indicar cantidad y monto (tomando de referencia el valor de las propiedades)
    + incremento: porcentaje calculado como oportunidades nuevas / oportunidades totales
- Ganadas  : 
    + oportunidades ganadas en el periodo. 
    + indicar cantidad y monto (tomando de referencia el valor de las propiedades)
    + conversion: porcentaje calculado como oportunidades ganadas / oportunidades totales
- Graficos
    + embudo de ventas: indicando cantidad y monto por etapa
    + evolución mensual: indicando opotunidades totales, nuevas y ganadas por periodo
- Ranking
    + Lista de oportunidades filtradas por tarjeta de cada KPI
