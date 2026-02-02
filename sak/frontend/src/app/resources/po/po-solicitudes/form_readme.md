# Form Readme - PoSolicitudes

Este documento describe el funcionamiento general del formulario de PoSolicitudes y sirve como patron para otras entidades.

## 1. Estructura general

El formulario esta dividido en dos niveles:
- `form.tsx`: cabecera + orquestacion principal del formulario.
- `form_detalle.tsx`: detalle (lineas/items) + UI del detalle.

`form.tsx` arma el layout, aplica defaults, integra subtitulos, define como se renderizan las secciones y expone el menu de acciones de cabecera (visualizar/aprobar/rechazar/eliminar).
`form_detalle.tsx` define la UI del detalle y se integra a traves de `FormDetailSection`.

## 2. Rol del schema

Existen dos schemas distintos definidos en `model.ts`:
- **Schema de cabecera** (`poSolicitudCabeceraSchema`): se usa para defaults del formulario principal.
- **Schema de detalle** (`poSolicitudDetalleSchema`): se usa por `FormDetailSection` para defaults, validacion y transformacion de cada item.

El schema **no serializa ni envia datos**. React Admin envia los valores del formulario. El schema se usa para:
- Defaults iniciales.
- Validacion de items (detalle) y normalizacion del formato.

## 3. Wrappers compact

Los wrappers compactos (ej: `CompactTextInput`, `CompactSelectInput`, `CompactDateInput`) son componentes de UI con estilos y defaults de presentacion.
Su objetivo es reducir codigo repetido (clases, tamanos, etc) y mantener consistencia visual.

Los wrappers **no reemplazan** el schema. El schema define reglas y defaults; los wrappers definen apariencia y ergonomia de los inputs.

## 4. Relacion entre form y form_detalle

- `form.tsx` declara la seccion de detalle mediante `FormDetailSection` y le pasa el `schema` del detalle (desde `model.ts`).
- `form_detalle.tsx` define como se ve cada item y como se edita (dialog, inputs, cards, etc).

Como se actualiza el detalle desde `form_detalle`:
- `form.tsx` monta `FormDetailSection`, que crea un formulario interno (`detalleForm`) y expone un contexto (`FormDetailSectionContext`).
- `form_detalle.tsx` consume ese contexto (via `useFormDetailSectionContext`) para:
  - abrir el dialogo,
  - leer/editar el item actual,
  - disparar `handleFormSubmit`.
- Al confirmar, `FormDetailSection` valida y transforma con el schema y actualiza el array `detalles` del formulario principal.

En resumen:
- `form.tsx` orquesta la lista de detalles y el schema del detalle.
- `form_detalle.tsx` define la UI del detalle y llama a los handlers del contexto.

## 4.1 Doble detalle (form principal vs FormDetailSection)

Hay dos niveles de detalle:
- **Detalle del form principal**: el array `detalles` dentro del formulario de cabecera.
- **Detalle de FormDetailSection**: un formulario interno para editar un solo item.

`FormDetailSection` sincroniza ambos:
- Cuando se crea/edita un item, valida y transforma con el schema.
- Luego actualiza el array `detalles` del form principal.

## 5. Relacion con model.ts

`model.ts` concentra reglas de dominio, constantes reutilizables y schemas:
- choices (estados, tipo compra, unidades)
- referencias a recursos (ARTICULOS_REFERENCE, etc)
- reglas de negocio (VALIDATION_RULES, helpers)
- schemas (cabecera y detalle)
- defaults y helpers de contexto
- builder unificado de payload (`buildPoSolicitudPayload`)

El formulario consume estas definiciones para construir defaults, filtros y opciones.

## 6. Relacion con form_hooks.ts

`form_hooks.ts` contiene la logica React reutilizable:
- catalogos (fetch de tipos, referencias)
- subtitulos de seccion
- defaults dinamicos
- sincronizacion de totales
- helpers de wizard
- emision de solicitudes (`usePoSolicitudEmit`)

El objetivo es que el form mantenga orquestacion simple y la logica se concentre en hooks.

## 7. Relacion con create_wizard

El wizard (`wizard_create.tsx`) crea la solicitud directamente y luego navega a edit:

Flujo:
1) `create.tsx` abre wizard.
2) Wizard construye payload y llama `onApply`.
3) `create.tsx` ejecuta `dataProvider.create`.
4) Navega a `edit` del nuevo registro.

El payload del wizard pasa por `buildPoSolicitudPayload`, el mismo helper que usa el form.

## 8. Guardado unificado (create/edit)

`create.tsx` y `edit.tsx` usan `transform` para normalizar datos antes de guardar:
- `buildPoSolicitudPayload` aplica defaults e inferencias (tipo_compra, totales, detalles).
- Esto asegura que wizard y form envien el mismo formato.

## 9. Reglas de consistencia

Para evitar inconsistencias:
- Definir reglas de negocio en **un solo lugar** (model o schema) y derivar el resto.
- Evitar duplicar reglas `required` en UI y schema.
- Usar wrappers compactos solo para UI, no para validacion.

## 10. Archivos clave

- `form.tsx`: cabecera y orquestacion.
- `form_detalle.tsx`: detalle (UI de items).
- `form_hooks.ts`: hooks reutilizables y subtitulos.
- `model.ts`: reglas de dominio y constantes.
- `wizard_create.tsx`: wizard asistido.
