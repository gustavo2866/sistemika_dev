
# Definición funcional – App de procesamiento de comprobantes (v1)

> Alcance: captura, interpretación y registración **hasta Pie** (no incluye asientos contables ni integración a ERP en esta versión).  
> UI basada en el **moc final** provisto por el usuario.

---

## 1) Objetivo
Digitalizar y estandarizar el ingreso de comprobantes (facturas/NC/ND) a partir de PDFs, reduciendo carga manual mediante extracción automática (OCR/LLM), aplicación de defaults por **setup de proveedor** y **tipo de operación**, y control de calidad (validaciones + auditoría de correcciones del usuario).

---

## 2) Flujo de alto nivel
1. **Subir comprobante (PDF)**  
2. **Cabecera:** completar/verificar datos principales (proveedor, comprobante, vencimiento, concepto/centro de costo/orden ref por default).  
3. **Detalle:** visualizar renglones principales; **string contable** solo en renglones **reclasificados**.  
4. **Pie:** subtotales como **ítems** (no tabla), impuestos unificados, total.  
5. **Confirmar registración** con validaciones y auditoría de cambios.

---

## 3) Modelo de datos (JSON de factura)
```json
{
  "proveedor": {
    "cuit": "20-12345678-9",
    "nombre": "Proveedor SA",
    "impuestos_obligatorios": [
      {"codigo": "IVA_21", "tasa": 0.21},
      {"codigo": "IIBB", "tasa": 0.02}
    ]
  },
  "comprobante": {
    "tipo": "Factura A",
    "numero": "0001-001245",
    "fecha": "2025-08-15",
    "moneda": "ARS",
    "vencimiento": "2025-09-14"
  },
  "tipo_operacion": "compra_insumos",       // inferido por LLM (editable)
  "concepto_default": "Materiales de obra",  // por setup de tipo de operación
  "centro_costo_default": "Obra 45",         // por setup + concepto
  "orden_ref_default": "OC-2025-123",        // obligatorio si así lo define el tipo de operación
  "detalle": [
    {
      "articulo": "001",
      "descripcion": "Cemento",
      "cantidad": 100,
      "precio": 1000.0,
      "importe": 100000.0,
      "concepto": null,
      "centro_costo": null,
      "orden_ref": null
    },
    {
      "articulo": "002",
      "descripcion": "Arena",
      "cantidad": 50,
      "precio": 800.0,
      "importe": 40000.0,
      "concepto": null,
      "centro_costo": null,
      "orden_ref": null
    },
    {
      "articulo": "003",
      "descripcion": "Flete",
      "cantidad": 1,
      "precio": 20000.0,
      "importe": 20000.0,
      "concepto": "Servicios de flete",
      "centro_costo": "Obra 45",
      "orden_ref": "OC-2025-123"
    }
  ],
  "subtotales": [
    {
      "importe": 140000.0,
      "concepto": "Materiales de obra",
      "centro_costo": "Obra 45",
      "orden_ref": "OC-2025-123"
    },
    {
      "importe": 20000.0,
      "concepto": "Servicios de flete",
      "centro_costo": "Obra 45",
      "orden_ref": "OC-2025-123"
    }
  ],
  "impuestos": [
    {"codigo": "IVA_21", "monto": 33600.0},
    {"codigo": "IIBB", "monto": 3200.0},
    {"codigo": "GCIAS_RET", "monto": 5000.0}
  ],
  "total": 201800.0,
  "auditoria": [
    {
      "campo": "tipo_operacion",
      "valor_detectado": "servicio_logistica",
      "valor_usuario": "compra_insumos",
      "usuario": "jdoe",
      "timestamp": "2025-08-16T10:42:12Z"
    }
  ],
  "estado": "borrador"  // borrador | registrado
}
```

### 3.1 Origen de datos
- **PDF/OCR/LLM:** CUIT, nombre proveedor, tipo/número/fecha, moneda, detalle (artículo/desc/cantidad/precio/importe), impuestos detectados, total, sugerencia de tipo de operación.  
- **Setup proveedor:** impuestos obligatorios (código+tasa).  
- **Setup tipo de operación:** concepto default, requerimiento y tipo de centro de costo, obligatoriedad de orden_ref, condición de pago → cálculo de vencimiento.  
- **Usuario:** validación/corrección de tipo de operación; modificación de concepto/CC/orden_ref por default; reclasificación por línea; correcciones puntuales.

---

## 4) Reglas de negocio
1. **String contable por línea** aparece **solo cuando difiere** del default (reclasificación).  
2. **Subtotales** se muestran como **ítems** (no tabla) debajo del detalle, con **importe** + **string contable** **en la misma línea**.  
3. **Impuestos**: una **única colección** (detectados + obligatorios faltantes).  
4. **Vencimiento** = fecha factura + condición de pago del tipo de operación (editable).  
5. **Orden Ref** obligatorio **solo** si así lo define el tipo de operación.  
6. **Auditoría**: guardar siempre valor_detectado / valor_inferido / valor_usuario.  
7. **Validación de consistencia**:  
   - total = suma(subtotales) +/− redondeos;  
   - suma(impuestos) coherente con base imponible;  
   - campos obligatorios completos (ej: orden_ref si aplica).

---

## 5) Validaciones y errores (UI)
- Indicadores en línea (✔ / ✖) y mensajes cortos.  
- Al **Confirmar registración**, bloquear si: campos obligatorios vacíos, desvío > tolerancia en totales, CUIT inválido, fecha fuera de rango, moneda vacía, etc.  
- Errores de OCR/LLM: marcar campos con **borde de advertencia** y sugerir edición.

---

## 6) API (contratos sugeridos)
- `POST /api/invoices/extract` → sube PDF, devuelve JSON preliminar. reutilizar funcion de upload en server. 
- `GET /api/providers/{cuit}` → ficha proveedor (impuestos obligatorios, defaults).  
- `GET /api/operations/types` → metadatos de tipos de operación, conceptos, CC, condiciones de pago.  
- `POST /api/invoices/validate` → valida estructura + reglas de negocio.  
- `POST /api/invoices/register` → persiste y marca estado `registrado`.  
- `POST /api/audit` → registra correcciones de usuario (si no se envían en `register`).

---

## 7) UI – Moc final (texto exacto)

### 📂 Subir comprobante (reutilizar componente de image-upload )
```
[ + Subir Factura PDF ]
(arrastrar y soltar o seleccionar archivo)
```

### 🧾 Cabecera
```
Proveedor:   [20-12345678-9] [Proveedor SA ▼]
Comprobante: [Factura A ▼] [0001-001245] [📅 15/08/2025]
Vencimiento: [📅 14/09/2025]
Concepto:    [Materiales de obra ▼] [Obra 45 ▼] [OC-2025-123]
```

### 📄 Detalle
```
001 Cemento   100   1.000   100.000
002 Arena      50     800    40.000
003 Flete       1  20.000   20.000   (Servicios de flete – Obra 45 – OC:2025-123)
```
- Fuente del **detalle** más pequeña que la cabecera.  
- **String contable**: gris claro + tamaño mínimo, **en la misma fila**; solo para excepciones.

### 📉 Pie
```
Subtotal 1: 140.000,00   (Materiales de obra – Obra 45 – OC:2025-123)
Subtotal 2:  20.000,00   (Servicios de flete – Obra 45 – OC:2025-123)

IVA 21% .................... 33.600,00
Percepción IIBB ............  3.200,00
Retención Ganancias .........  5.000,00

TOTAL COMPROBANTE: 201.800,00
```

### 🎛️ Comportamientos clave
- Dropdowns en `Proveedor SA`, `Factura A`, `Materiales de obra`, `Obra 45`.  
- Datepickers en `Comprobante.fecha` y `Vencimiento`.  
- “Ver más…” si el detalle supera 3 líneas.  
- Al editar una línea con reclasificación → recalcular subtotales y regenerar líneas de **Pie**.  
- Acciones: **Guardar borrador** / **Confirmar registración** (primario).

---

## 8) Seguridad y auditoría
- Trazabilidad por usuario/fecha/IP.  
- Control de acceso por rol (operador, aprobador, admin).  
- Historial inmutable de correcciones.

---

## 9) Accesibilidad y UX
- Contraste AA, foco visible, navegación por teclado, labels asociados.  
- Feedback inmediato en validaciones, estados de carga en subida de PDF.  
- Microcopy consistente y localización es-AR (formatos de fecha/miles).

---

## 10) Futuras extensiones (no incluidas v1)
- Asientos contables automáticos por **concepto**.  
- Conciliación con OC/Recepciones.  
- Integraciones ERP/AFIP.  
- Motor de reglas antifraude.
