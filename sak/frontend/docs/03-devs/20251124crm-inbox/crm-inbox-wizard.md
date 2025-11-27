# CRM Inbox Wizard – Estado Actual

Este documento describe cómo funciona hoy el formulario `CRMInboxConfirmForm`, siguiendo la estructura “cada paso valida su bloque y prepara datos para el siguiente”.

## Paso 1: Contacto

- **Inputs principales**
  - `contacto_nuevo`: checkbox para decidir entre contacto nuevo o existente.
  - `contacto_nombre`, `contacto_referencia`, `contacto_responsable_id` (solo modo nuevo).
  - `contacto_id`: combobox (`CONTACTO_REFERENCE`) para elegir un contacto existente.
- **Validación de paso**
  - Se ejecuta `getContactoValidationError(values)` antes de avanzar; exige que:
    - Si es nuevo, haya nombre y responsable.
    - Si es existente, se seleccione `contacto_id`.
- **Preparación del siguiente bloque**
  - `useEffect` (líneas 212-291) observa `contacto_nuevo` y `contacto_id`:
    - Si es nuevo, limpia campos dependientes (`contacto_id`, `oportunidad_id`, `tipo_operacion_id`, `propiedad_id`), marca `crear_oportunidad=true` y pone `forceNuevaOportunidad`.
    - Si se elige un contacto existente:
      1. Carga la ficha del contacto (`dataProvider.getOne("crm/contactos")`) para completar `contacto_nombre`.
      2. Busca la última oportunidad abierta (`getList("crm/oportunidades")`).
      3. Si hay oportunidad abierta:
         - Rellena `autoOportunidad` con id, labels, tipo, responsable, propiedad.
         - Marca `crear_oportunidad=false`, setea `oportunidad_id` y copia tipo, propiedad y estado.
      4. Si no hay oportunidad:
         - Limpia `autoOportunidad`, marca `crear_oportunidad=true` y resetea los campos.

## Paso 2: Oportunidad

- **Inputs principales**
  - `crear_oportunidad`: checkbox (acción en el header del `SectionCard`).
  - Campos de oportunidad nueva cuando `crear_oportunidad=true`:
    - `tipo_operacion_id` (`TIPOS_OPERACION_REFERENCE`).
    - `propiedad_id` (`PROPIEDADES_REFERENCE`) con filtro a `tipo_operacion`.
    - `responsable_oportunidad_id` (`USERS_REFERENCE`).
  - Alternativa “oportunidad existente”:
    - `oportunidad_id` (`OPORTUNIDADES_REFERENCE`) filtrado por `contacto_id`.
- **Validación de paso**
  - `getOportunidadValidationError(values)`:
    - Si crea nueva oportunidad: requiere tipo, propiedad y responsable.
    - Si usa existente: exige `oportunidad_id` y que el backend haya rellenado tipo y propiedad.
- **Preparación del siguiente bloque**
  - Efectos secundarios relevantes:
    - `useEffect` (línea ~294) limpia `oportunidad_id` y `autoOportunidad` cuando se activa `crear_oportunidad`.
    - Otro `useEffect` (líneas 301-342) recarga la oportunidad seleccionada para poblar `autoOportunidad`, tipo, propiedad y estado.
    - `useEffect` (línea 335 aprox.) fuerza `proximo_estado = "1-abierta"` al crear una oportunidad.
    - `useMemo` genera `oportunidadSummary` y `respuestaSummary`, usados como contexto visual.
  - Estos efectos dejan listo el paso 3 con:
    - `proximo_estado` (derivado de la oportunidad existente o “1-abierta”).
    - Labels (`resumenOportunidadTexto`, `responsableTexto`) que se muestran también en el `MessagePreview`.

## Paso 3: Evento / Respuesta

- **Inputs principales**
  - `evento_tipo_id` y `evento_motivo_id` (`TIPOS_EVENTO_REFERENCE` y `MOTIVOS_EVENTO_REFERENCE`, con filtro dependiente).
  - `proximo_estado` (select con `ESTADO_OPORTUNIDAD_CHOICES`, deshabilitado si se crea oportunidad nueva).
  - `fecha_proximo_estado`.
  - `evento_asignado_id` (`USERS_REFERENCE`).
  - `evento_descripcion` y `enviar_respuesta`.
- **Validación de paso**
  - No hay validación adicional en `handleStepValidate`; la verificación ocurre al construir el payload (`buildConfirmPayload`).
- **Preparación del submit**
  - Al confirmar, `submit()`:
    - Llama a `buildConfirmPayload(values)` para traducir los campos en la estructura esperada por `/crm/mensajes/:id/confirmar`.
    - Envía el payload al backend y refresca la lista.

## Resumen por bloque

| Paso | Validación de negocio | Configuración del siguiente bloque |
| ---- | --------------------- | ----------------------------------- |
| Contacto | `getContactoValidationError` | `useEffect` que rellena/limpia oportunidad y campos dependientes basándose en contacto seleccionado. |
| Oportunidad | `getOportunidadValidationError` | `useEffect` que sincroniza `autoOportunidad`, `proximo_estado` y habilita/deshabilita controles del paso 3. |
| Evento/Respuesta | Validación al generar payload (`buildConfirmPayload`). | No prepara otro bloque; finaliza enviando los datos. |

> **Nota:** Hoy las reglas de negocio para validar y “preparar” cada paso se ejecutan dentro del componente (via `useEffect`). El objetivo futuro es mover toda esa lógica a helpers de dominio para que cada transición de paso sea declarativa y testeable.
