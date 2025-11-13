# SPEC FRONT - Centro de Costo y Precios en Solicitudes

> **Referencia primaria:** `20251111_solicitudes_CentroCosto_spec_db.md`  
> **Versión:** 0.1 (borrador frontend) – 2025-11-12

---

## Resumen Ejecutivo
- Crear el recurso `centros-costo` en el panel React Admin con CRUD completo (listado, alta, edición y show) siguiendo el patrón existente en `src/app/resources/*`.
- Incorporar el nuevo `centro_costo_id` a todo el flujo de solicitudes (listas, filtros, formularios cabecera, show y API payload).
- Habilitar captura de `precio` e `importe` por cada detalle de solicitud; el importe se calcula en el frontend antes de enviar datos.
- Ajustar componentes compartidos (modelos, schemas, totales, tarjetas de detalle) para reflejar los nuevos campos y mantener la experiencia UX consistente.

---

## 1. Nuevo Recurso `centros-costo`

-### 1.1 Estructura del módulo
- Crear carpeta `frontend/src/app/resources/centros-costo/` tomando como referencia directa el patrón de `src/app/resources/solicitudes/` (usa `FormLayout`, secciones, helpers compartidos) para mantener coherencia con el flujo operativo actual.
- Exportar desde `frontend/src/app/resources/index.ts` y registrar el `Resource` en `frontend/src/app/admin/AdminApp.tsx` (icono sugerido: `Building` o `Wallet`, label “Centros de Costo”). Endpoint: `name="centros-costo"`.

### 1.2 Modelo y esquema
- `model.ts`
  - Definir `CENTRO_COSTO_TIPO_CHOICES = ["General","Proyecto","Propiedad","Socios"]` (hardcodeado por ahora según spec DB §1.1 y §9.1.5).
  - Tipo principal:
    ```ts
    export type CentroCosto = {
      id: number;
      nombre: string;
      tipo: CentroCostoTipo;
      codigo_contable: string;
      descripcion?: string | null;
      activo: boolean;
      created_at: string;
      updated_at: string;
    };
    ```
  - `CentroCostoFormValues` con strings para selects y defaults (`activo: true`).
  - Zod schema via `createEntitySchema` para validar: `nombre` requerido/max 200, `tipo` requerido/max 50, `codigo_contable` requerido/max 50, `descripcion` opcional/max 1000, `activo` boolean. Añadir helper `centroCostoSchema.defaults()` para formularios.

### 1.3 Listado (`list.tsx`)
- Basarse en los listados de `solicitudes` (toolbar con filtros avanzados, badges, acciones compactas) reutilizando los mismos componentes utilitarios (`ListActions`, `StatusBadge`, etc.).
- Columnas mínimas: `nombre`, `tipo` (badge), `codigo_contable`, `activo` (chip), `updated_at` (RelativeDate), acciones (edit/show).
- Filtros:
  - `TextInput` para búsqueda (`q`) apuntando a `nombre`/`codigo_contable` (usar dataProvider filter `{"q": value}` o `{"nombre__ilike": "%value%"}` según convenga).
  - `SelectInput` para `tipo` usando `CENTRO_COSTO_TIPO_CHOICES`.
  - `BooleanInput` o toggle para `activo`.
  - Recordar enviar `filter` estructurado al dataProvider (`filter: { tipo, activo }`).

### 1.4 Alta/Edición (`form.tsx`, `create.tsx`, `edit.tsx`)
- Reutilizar `SimpleForm` con campos:
  1. `nombre` (`TextInput`, requerido).
  2. `tipo` (`SelectInput`, choices del enum, requerido).
  3. `codigo_contable` (`TextInput`, requerido, uppercase opcional).
  4. `descripcion` (`TextInput` multiline, opcional).
  5. `activo` (`BooleanInput`).
- Mostrar alerta si `activo` está en `false` (los recursos referenciados no deberían ofrecerse en combos).
- `create.tsx`/`edit.tsx`: wrappers que importan `CentroCostoForm` y asignan títulos.

### 1.5 Vista Show
- Presentar resumen en tarjetas (`SimpleShowLayout`) con secciones para datos básicos y metadata (`created_at`, `updated_at`). Incluir chips para `tipo` y `activo`.

### 1.6 UX adicionales
- Al borrar (soft delete) mostrar confirmación de que las solicitudes existentes conservarán la referencia.
- Documentar en `README` o `BUILD_REPORT.md` el nuevo recurso.

---

## 2. Cambios en Solicitudes (Cabecera y Listas)

### 2.1 Modelo y schemas
- `frontend/src/app/resources/solicitudes/model.ts`:
  - Agregar `centro_costo_id?: number | string` a `Solicitud` y `SolicitudCabeceraFormValues` (string en formulario, number en payload).
  - Incluir `CENTROS_COSTO_REFERENCE = { resource: "centros-costo", labelField: "nombre", limit: 100, staleTime: 5m, filter: { activo: true } }`.
  - Actualizar `solicitudCabeceraSchema` para definir el campo (`referenceField` con `required: true`, `defaultValue: "1"` para “Sin Asignar”). Asegurarse de serializar a `number` al enviar.

### 2.2 Formularios (`solicitudes/form.tsx`)
- Añadir `ReferenceInput` (cabecera “Centro de costo”) usando `CENTROS_COSTO_REFERENCE`. Validación `required()`.
- Inicializar con ID=1 (“Sin Asignar”) en `defaultValues` solo si backend confirma que existe. Mantener `useAutoInitializeField` si procede.
- Mostrar `centro_costo` dentro de la sección “Datos Generales” y reflejarlo en el `generalSubtitle` opcional.
- Si el usuario cambia `tipo_solicitud`, no se altera el centro de costo (no hay dependencia, solo default).

### 2.3 Listado/Show/Filters
- `solicitudes/list.tsx`:
  - Nueva columna `centro_costo.nombre` (usar `ReferenceField` o `TextField` con `source="centro_costo.nombre"`).
  - Agregar filtro `ReferenceInput` para `centro_costo_id` usando el mismo reference config.
- `solicitudes/show.tsx`: incluir bloque “Centro de costo” con nombre, tipo, código contable.
- Revisar `dataProvider` calls (actions `create`/`update`) para enviar `centro_costo_id` numérico.

### 2.4 Navegación rápida
- Si existen atajos (`/solicitudes/create-mb`), asegurarse de que el nuevo campo aparezca en esas rutas también.

---

## 3. Solicitud Detalle: Precio e Importe

### 3.1 Modelos y validaciones
- `solicitudDetalleSchema` en `model.ts`:
  - Agregar campos `precio` (número decimal >= 0, default `"0"`) e `importe` (decimal, default `"0"`, validado pero calculado por UI).
  - Ajustar tipos `SolicitudDetalle` / `DetalleFormValues` para incluir ambos campos (`precio: number`, `importe?: number`). Mantener `importe` opcional para permitir recalcular.

### 3.2 Formulario de detalle
- En `Solicitudes/form.tsx` (`SolicitudDetalleForm`):
  - Añadir `FormField` con `Input type="number"` para `precio` (step 0.01, min 0). Etiqueta “Precio unitario (ARS)” o similar.
  - Añadir campo de solo lectura para `importe` mostrando `cantidad * precio`. Se puede renderizar como `Input` disabled o `DetailBadge`. Actualizar en `useEffect` o dentro del handler `setValue` cuando cambian `cantidad` o `precio` (usar `watch` + `useEffect`).
  - Validar que se recalcula `importe` en tiempo real antes de cerrar el diálogo de detalle.

### 3.3 Visualización y totales
- `FormDetailCard` (tarjeta en lista): mostrar `Precio` y `Importe` además de `Cantidad`.
- `SolicitudTotals` debe sumar `detalles.reduce((acc, d) => acc + (d.importe || d.cantidad * d.precio), 0)` y mostrar el total formateado.
- Asegurar que el payload enviado a la API incluye ambos campos numéricos (`precio`, `importe`). Convertir strings a números antes de persistir.

### 3.4 UX/Errores
- Si `precio` queda vacío, setear 0 para evitar `NaN`. Mostrar validación “El precio no puede ser negativo”.
- Desambiguar moneda (ARS) en etiquetas y tooltips.

---

## 4. Integraciones y utilidades compartidas
- Actualizar `frontend/src/app/resources/solicitudes/index.ts` (si expone tipos) para propagar los cambios.
- Considerar helper reutilizable (`formatCurrency`) para mostrar `importe` en tarjetas y totales.
- Revisar `ComboboxQuery` usos para pasar `filter: { activo: true }` al cargar centros.
- Documentar en `doc/03-devs/.../BUILD_REPORT.md` los pasos de UI y cualquier feature flag.
- QA: crear fixtures en `/frontend/scripts/test-backend.js` o similar para validar que `/centros-costo` responde y que `/solicitudes` envía nuevos campos.

---

## 5. Dudas / Definiciones Pendientes
1. **Valores permitidos de `tipo`:** ¿La lista `["General","Proyecto","Propiedad","Socios"]` es definitiva o debe ser parametrizable desde backend? (impacta si usamos `hardcoded choices` o `ComboboxQuery`).
2. **Default “Sin Asignar”:** Se asume que el ID=1 existirá siempre. ¿Confirmamos que producción tendrá ese registro y que el frontend puede usarlo como default sin fetch previo?
3. **Visibilidad de centros inactivos:** ¿Los centros con `activo = false` deben ocultarse en el combobox pero seguir mostrándose en listados? (sugerencia: filtrar en combos pero permitir verlos en la grilla con badge “Inactivo”).
4. **Formato monetario:** ¿Precio/Importe se muestran y editan en ARS con 2 decimales? ¿Necesitamos manejar impuestos o múltiples monedas en esta iteración?
5. **Compatibilidad móvil (rutas `/solicitudes/*-mb`):** confirmado, los campos nuevos deben estar disponibles también en los formularios mobile.
6. **Validación backend redundante:** confirmado, debemos mostrar alerta/log si el backend responde con un `importe` distinto al calculado localmente.

> ✅ Todas las dudas de la sección quedaron respondidas:
> 1. Tipos permitidos: valores hardcodeados `["General","Proyecto","Propiedad","Socios"]` (definitivo).
> 2. Default: el centro “Sin Asignar” existe con `id = 1`, podemos usarlo como default sin fetch previo.
> 3. Combos: ocultar centros con `activo = false` en selects, aunque sigan visibles en listados.
> 4. Moneda: siempre ARS con 2 decimales.
> 5. Mobile: replicar cambios en rutas `/solicitudes/*-mb`.
> 6. Reconciliación: comparar importes devueltos por backend y alertar cuando difieran.

---

## 6. Ajustes adicionales solicitados
1. **Patrón de módulo:** se refuerza que `centros-costo` debe seguir el estilo de `solicitudes` (layout con secciones, helpers `FormLayout`, `FormSimpleSection`, etc.) en lugar de otros recursos simples como proveedores.
2. **Total en solicitudes:** agregar lógica explícita para recalcular `importe` y `total` en tiempo real:
   - Hook `useEffect` que observa `watch("detalles")` y actualiza `form.setValue("total", sumaImportes)` en cada cambio. Usar `setValue` con `{ shouldDirty: true, shouldValidate: true }`.
   - Persistir `total` dentro de `defaultValues` y en el payload final (`prepareSubmitPayload`) para garantizar que el backend reciba el valor correcto.
   - Mostrar indicador (spinner o mensaje) cuando el cálculo está en progreso para evitar guardar valores desfasados.
   - Al recibir respuesta del backend, comparar `importe`/`total` y notificar si existen discrepancias (ver punto 6 anterior).

---

**Próximos pasos:** validar dudas con producto/contabilidad, luego estimar esfuerzo y crear tickets separados para cada bloque (nuevo recurso, ajustes de solicitudes, mejoras UX). Después de implementar, actualizar manuales de usuario y plan de pruebas E2E. 
