# Inicialización del Sistema — SAK

Guía de referencia para inicializar un ambiente nuevo (test, staging, cliente).

## Conceptos

| Categoría | Descripción |
|-----------|-------------|
| **PARÁMETROS** | Tablas de configuración base. Se deben revisar y cargar antes de operar. Representan catálogos, tipos, estados y configuraciones que definen el comportamiento del sistema. |
| **DATOS OPERATIVOS** | Tablas que acumulan registros durante el uso. Se limpian al inicializar un ambiente. |

## Orden recomendado de inicialización

```
1. Aplicar migraciones (alembic upgrade head)
2. Cargar PARÁMETROS (catálogos base)
3. Crear usuarios del sistema
4. Verificar settings del sistema
5. El sistema está listo para operar
```

---

## Módulo: Sistema / Global

### Parámetros — revisar antes de operar ((OK))

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios del sistema. Seed: Usuario Demo. Crear usuarios reales antes de operar. |
| `paises` | Catálogo de países. Seed: Argentina, Brasil. Agregar según necesidad. |
| `departamentos` | Departamentos organizacionales. Definir estructura de la empresa. |
| `centros_costo` | Centros de costo. Definir estructura contable. |
| `settings` | Configuración clave-valor. Ver claves requeridas abajo. |

#### Settings requeridas ((ok))

| Clave | Descripción | Seed |
|-------|-------------|------|
| `INM_Dias_Vencimiento` | Días para vencimiento de contratos inmobiliarios | `30` |
| `INM_Dias_Actualizacion` | Días de anticipación para notificar actualización | `15` |
| `INM_Dias_Vacancia` | Días para considerar una propiedad en vacancia | `30` |

### Datos operativos — limpiar al inicializar ((Ok))

| Tabla | Descripción |
|-------|-------------|
| `webhook_logs` | Log de webhooks entrantes (WhatsApp, etc.) |

---

## Módulo: CRM

### Parámetros — revisar antes de operar ((Ok))

| Tabla | Descripción | Observaciones |
|-------|-------------|---------------|
| `crm_tipos_operacion` | Tipos de operación: Venta, Alquiler, etc. | Obligatorio. Sin datos no se pueden crear oportunidades. |
| `crm_motivos_perdida` | Motivos de pérdida de oportunidades | Recomendado. |
| `crm_condiciones_pago` | Condiciones de pago disponibles | Recomendado. |
| `crm_tipos_evento` | Tipos de evento CRM | Obligatorio. Sin datos no se pueden registrar eventos. |
| `crm_motivos_evento` | Motivos de evento CRM | Recomendado. |
| `crm_catalogo_respuestas` | Respuestas rápidas de WhatsApp | Opcional. Cargar templates de respuesta. |
| `crm_tipos_contacto` | Tipos de contacto: Inmobiliaria, Particular, etc. | Obligatorio. |
| `monedas` | Catálogo de monedas: USD, ARS, etc. | Obligatorio. |
| `crm_celulares` | Canales de WhatsApp Business conectados a Meta API | Obligatorio si se usa WhatsApp. Configurar con `meta_celular_id` y número. |

### Datos operativos — limpiar al inicializar ((OK))

| Tabla | Descripción |
|-------|-------------|
| `crm_contactos` | Clientes y leads registrados |
| `crm_oportunidades` | Pipeline de ventas |
| `crm_eventos` | Eventos por oportunidad |
| `crm_mensajes` | Mensajes WhatsApp recibidos/enviados |
| `crm_oportunidad_log_estado` | Log de cambios de estado de oportunidades |

---

## Módulo: Inmobiliaria

### Parámetros — revisar antes de operar ((OK))

| Tabla | Descripción | Observaciones |
|-------|-------------|---------------|
| `tipos_propiedad` | Casa, Departamento, Galpón, Oficina, etc. | Obligatorio. |
| `tipos_contrato` | Alquiler, Comodato, Alquiler Temporario, etc. | Obligatorio. |
| `tipos_actualizacion` | ICL, IPC, Fijo, etc. | Obligatorio para contratos. |
| `propiedades_status` | Estados: Disponible, Alquilada, En venta, etc. | Obligatorio. |
| `servicios_tipo` | Agua, Luz, Gas, Expensas, etc. | Recomendado. |
| `propietarios` | Propietarios registrados | Cargar antes de crear propiedades. |
| `emprendimientos` | Proyectos/emprendimientos inmobiliarios | Cargar los emprendimientos existentes. |

### Datos operativos — limpiar al inicializar

| Tabla | Descripción |
|-------|-------------|
| `propiedades` | Portfolio de propiedades gestionadas |
| `propiedades_log_status` | Historial de cambios de estado por propiedad |
| `propiedades_servicios` | Servicios asociados a cada propiedad |
| `contratos` | Contratos de alquiler/comodato vigentes e históricos |
| `contratos_archivos` | Archivos adjuntos a contratos |

---

## Módulo: Compras (Purchase Orders)

### Parámetros — revisar antes de operar ((OK))

| Tabla | Descripción | Observaciones |
|-------|-------------|---------------|
| `po_order_status` | Estados de orden: Borrador, Aprobada, Recibida, etc. | Obligatorio. |
| `po_invoice_status` | Estados de factura de proveedor | Obligatorio. |
| `po_invoice_status_fin` | Estados financieros de factura | Obligatorio. |
| `tipos_solicitud` | Tipos de solicitud de compra | Obligatorio. |
| `tipos_articulo` | Material, Servicio, Herramienta, etc. | Obligatorio. |
| `articulos` | Catálogo de productos/servicios disponibles para órdenes | Revisar y ampliar según rubro. |
| `tipos_comprobante` | Factura A/B/C, NC A/B/C, etc. | Obligatorio para facturas. |
| `metodos_pago` | Efectivo, Transferencia, Cheque, etc. | Obligatorio. |
| `tax_profiles` | Perfiles de configuración de impuestos (IVA, etc.) | Revisar alícuotas. |
| `tax_profile_details` | Detalle de alícuotas por perfil | Revisar según jurisdicción. |
| `adm_conceptos` | Conceptos contables/administrativos | Revisar y ampliar. |
| `tipos_operacion` | Tipos de operación fiscal: compra, venta, etc. | Requerido por facturas. Incluye configuración de IVA y cuenta contable. |
| `proveedores` | Proveedores dados de alta | Cargar antes de crear órdenes de compra. |

### Datos operativos — limpiar al inicializar ((OK))

| Tabla | Descripción |
| `po_orders` | Órdenes de compra emitidas |
| `po_order_details` | Líneas de detalle por orden |
| `po_order_status_log` | Log de cambios de estado de órdenes |
| `po_invoices` | Facturas de proveedores |
| `po_invoice_detalles` | Líneas de detalle por factura |
| `po_invoice_taxes` | Impuestos por factura |
| `po_orders_archivos` | Archivos adjuntos a órdenes |
| `facturas` | Facturas legacy |
| `factura_detalles` | Detalles de facturas legacy |
| `factura_impuestos` | Impuestos de facturas legacy |
| `comprobantes` | Staging de documentos OCR/LLM |
| `cotizacion_moneda` | Historial de cotizaciones de moneda |

---

## Módulo: Proyectos (Constructora)

### Parámetros — revisar antes de operar ((Ok))

> Este módulo no tiene tablas de parámetros propias. Depende de `centros_costo`, `users` y `crm_oportunidades`.

| Tabla | Descripción | Observaciones |
|-------|-------------|---------------|
| `proy_fases` | Fases estándar del ciclo de un proyecto | Cargar las fases base antes de crear proyectos. |

### Datos operativos — limpiar al inicializar ((Ok))

| Tabla | Descripción |
|-------|-------------|
| `proyectos` | Proyectos en curso o cerrados |
| `proyecto_avance` | Hitos de avance por proyecto |
| `proy_presupuestos` | Ítems de presupuesto por proyecto |
| `partes_diario` | Partes diarios de obra |
| `partes_diario_detalles` | Líneas de detalle por parte diario |

---

## Módulo: RRHH

### Datos operativos — limpiar al inicializar

| Tabla | Descripción |
|-------|-------------|
| `nominas` | Empleados de la empresa |
| `tareas` | Tareas/actividades asignadas |

---

## Tablas excluidas de esta guía

| Tabla | Motivo |
|-------|--------|
| `item` | Tabla scaffold de demo. No se usa en producción. |
| `vw_kpis_proyectos_po_orders` | Vista SQL de solo lectura. No requiere carga de datos. |

---
