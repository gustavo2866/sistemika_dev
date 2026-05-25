# Encargado en Proyecto

## Objetivo

Agregar en `proyectos/form` un campo visual `Encargado` que represente el contacto asociado a la oportunidad CRM del proyecto.

El dato no debe duplicarse en `Proyecto`. La fuente de verdad debe seguir siendo:

```text
CRMOportunidad.contacto_id
```

## Relacion de datos

El vinculo actual es:

```text
Proyecto.oportunidad_id
  -> CRMOportunidad.id
  -> CRMOportunidad.contacto_id
  -> CRMContacto.id
```

Los mensajes entrantes del agente tambien usan esta relacion:

```text
CRMMensaje.contacto_id
CRMMensaje.oportunidad_id
```

Por lo tanto, para el caso "quien escribe al agente", el campo correcto es `CRMOportunidad.contacto_id`, no `CRMOportunidad.responsable_id`.

## Cambios propuestos

### Backend

La sincronizacion debe resolverse en backend, dentro del CRUD de `Proyecto`, para evitar que el frontend tenga que llamar a dos endpoints.

El frontend enviara un campo auxiliar:

```text
encargado_contacto_id
```

Ese campo no debe persistirse en `Proyecto`; solo se usa para crear o actualizar la oportunidad asociada.

En `backend/app/models/proyecto.py`, asegurar que `Proyecto` incluya la oportunidad relacionada en la respuesta:

```python
__auto_include_relations__ = ["avances", "oportunidad"]
```

Si el formulario necesita mostrar el nombre del contacto sin consultas adicionales, evaluar incluir la relacion `contacto` dentro de la oportunidad.

#### Creacion

En `ProyectoCRUD.create`:

1. Extraer `encargado_contacto_id` del payload antes de crear el proyecto.
2. Crear el proyecto como hoy.
3. Si `encargado_contacto_id` viene informado:
   - Usarlo como `CRMOportunidad.contacto_id`.
   - No crear el contacto automatico `proyecto: {nombre}`.
4. Si `encargado_contacto_id` no viene informado:
   - Mantener el comportamiento actual: crear `CRMContacto` automatico y usarlo como contacto de la oportunidad.
5. Crear la `CRMOportunidad`.
6. Asignar `proyecto.oportunidad_id = oportunidad.id`.
7. Confirmar todo en la misma transaccion.

#### Actualizacion

En `ProyectoCRUD.update`:

1. Extraer `encargado_contacto_id` del payload.
2. Actualizar el proyecto como hoy.
3. Si `encargado_contacto_id` viene informado y el proyecto tiene `oportunidad_id`:
   - Cargar la `CRMOportunidad`.
   - Actualizar `CRMOportunidad.contacto_id = encargado_contacto_id`.
4. Confirmar todo en la misma transaccion.

Si el proyecto no tiene `oportunidad_id`, se debe decidir entre:

- Ignorar el valor y devolver warning controlado.
- Crear la oportunidad faltante.
- Rechazar la actualizacion con error claro.

La opcion recomendada es rechazar con error claro, porque un proyecto sin oportunidad rompe el contrato de sincronizacion.

### Frontend model

En `frontend/src/app/resources/constructora/proyectos/model.ts`, extender el tipo de proyecto para contemplar la oportunidad:

```ts
oportunidad?: {
  id?: number | string | null;
  contacto_id?: number | string | null;
  contacto?: {
    id?: number | string | null;
    nombre_completo?: string | null;
  } | null;
} | null;
```

No agregar `encargado_id` al modelo persistido de `Proyecto`, porque no existe como columna propia.

Si el formulario usa validacion con `zod`, se puede permitir el campo auxiliar `encargado_contacto_id` en el schema del form para que viaje en el payload, pero debe quedar documentado como campo no persistido de `Proyecto`.

### Formulario

En `proyectos/form.tsx`, agregar un campo visual `Encargado` basado en un campo auxiliar del formulario, por ejemplo:

```text
encargado_contacto_id
```

Ese campo debe:

- Inicializarse desde `record.oportunidad?.contacto_id`.
- Renderizarse como selector/autocomplete de `crm/contactos`.
- Filtrar contactos por tipo de contacto `encargado`.
- Usar como texto visible `nombre_completo`.
- No formar parte del payload normal de `Proyecto`.
- Enviarse como campo auxiliar `encargado_contacto_id` para que el backend sincronice la oportunidad.

El filtro debe resolverse contra el catalogo de tipos de contacto. La implementacion recomendada es:

1. Buscar el registro en `crm/catalogos/tipos-contacto` cuyo nombre/codigo sea `encargado`.
2. Usar su `id` para filtrar el autocomplete de contactos:

```ts
filter: { tipo_id: encargadoTipoContactoId }
```

Si no existe el tipo `encargado`, el campo deberia quedar sin opciones o mostrar una advertencia controlada, para evitar seleccionar contactos de otro tipo.

### Guardado

Al guardar, el frontend debe enviar `encargado_contacto_id` junto con el payload de `Proyecto`.

No debe hacer un `PATCH` separado a `/crm/oportunidades/{id}`.

El backend debe tomar ese campo auxiliar y sincronizar `CRMOportunidad.contacto_id` dentro de la misma operacion de creacion o actualizacion del proyecto.

## Consideraciones

- Cambiar `CRMOportunidad.contacto_id` cambia el contacto principal de la oportunidad.
- Los mensajes existentes mantienen su propio `CRMMensaje.contacto_id`; no deberian actualizarse automaticamente.
- Los pedidos de obra existentes que tengan `contacto_id` tampoco deberian cambiar automaticamente.
- La sincronizacion recomendada es desde el formulario de proyecto hacia la oportunidad, pero ejecutada en backend dentro del CRUD de proyecto.
- `CRMOportunidad.contacto_id` sigue siendo la unica fuente de verdad para el encargado/contacto que escribe al agente.
