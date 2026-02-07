# poOrders resource (Shadcn Admin Kit standard)



This document describes how to build a `poOrders` resource using only the

standard Shadcn Admin Kit patterns (no repo-specific patterns). The only

repo check performed is the dataProvider handling in the `users` resource.



**DataProvider handling (verified)**

The `users` resource does not create its own dataProvider. It relies on the

global `<Admin dataProvider={dataProvider}>` defined in

`frontend/src/app/admin/AdminApp.tsx`, and the `users` components are simple

`List/Create/Edit/Show` views with no custom provider wiring

(`frontend/src/app/resources/users/list.tsx`, `create.tsx`, `edit.tsx`, `show.tsx`).

The `poOrders` resource should follow the same approach.



**Resource name and endpoints**

Use the REST resource name `po-orders`. React Admin will call:

`GET /po-orders`, `GET /po-orders/:id`, `POST /po-orders`,

`PUT /po-orders/:id`, `DELETE /po-orders/:id`.

The backend must accept nested `detalles` in create/update payloads.



**Pagination (server-side)**

- The app uses `ra-data-simple-rest` in `frontend/src/lib/dataProvider.ts`, so `getList` is server-side paginated and relies on `Content-Range`.

- To match the existing `users` list behavior, set `perPage={10}` on the `List`:

```tsx

<List perPage={10}>

  ...

</List>

```



**File structure (recommended)**

- `frontend/src/app/resources/po-orders/List.tsx`

- `frontend/src/app/resources/po-orders/form.tsx`

- `frontend/src/app/resources/po-orders/create.tsx`

- `frontend/src/app/resources/po-orders/edit.tsx`

- `frontend/src/app/resources/po-orders/show.tsx`

- `frontend/src/app/resources/po-orders/model.ts` (Zod schema + domain types)

- `frontend/src/app/resources/po-orders/index.ts`



**Resource registration**

```tsx

import { Resource } from "ra-core";

import { PoOrderList, PoOrderCreate, PoOrderEdit, PoOrderShow } from "@/app/resources/po-orders";



<Resource

  name="po-orders"

  list={PoOrderList}

  create={PoOrderCreate}

  edit={PoOrderEdit}

  show={PoOrderShow}

  recordRepresentation="titulo"

/>;

```



**List (cabecera)**
Standard kit pattern: `List` + `DataTable`.
```tsx
import { List, DataTable, ReferenceField, NumberField } from "@/components/admin";

export const PoOrderList = () => (
  <List>
    <DataTable>
      <DataTable.Col source="id" />

      <DataTable.Col source="titulo" />

      <DataTable.Col label="Solicitante">

        <ReferenceField source="solicitante_id" reference="users" />

      </DataTable.Col>

      <DataTable.Col label="Tipo solicitud">

        <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud" />

      </DataTable.Col>

      <DataTable.Col label="Proveedor">

        <ReferenceField source="proveedor_id" reference="proveedores" />

      </DataTable.Col>

      <DataTable.Col label="Importe">

        <NumberField source="total" />

      </DataTable.Col>

    </DataTable>
  </List>
);
```

**List responsive (adaptive card)**
Alternativa recomendada: usar el componente reutilizable `ResponsiveDataTable`
que ya incluye vista en tarjeta para mobile (card adaptativa) y permite
personalizar el contenido con `mobileConfig` o `customCard`.
```tsx
import { List, ReferenceField, NumberField } from "@/components/admin";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";

export const PoOrderList = () => (
  <List>
    <ResponsiveDataTable
      mobileConfig={{
        primaryField: "titulo",
        secondaryFields: ["solicitante_id", "tipo_solicitud_id"],
        detailFields: [
          { source: "proveedor_id", reference: "proveedores", referenceField: "nombre" },
          { source: "total", type: "number" },
        ],
      }}
    >
      <ResponsiveDataTable.Col source="id" />
      <ResponsiveDataTable.Col source="titulo" />
      <ResponsiveDataTable.Col label="Solicitante">
        <ReferenceField source="solicitante_id" reference="users" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col label="Tipo solicitud">
        <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col label="Proveedor">
        <ReferenceField source="proveedor_id" reference="proveedores" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col label="Importe">
        <NumberField source="total" />
      </ResponsiveDataTable.Col>
    </ResponsiveDataTable>
  </List>
);
```

Ejemplo con `customCard` usando el componente reutilizable `DetailItemCard`:
```tsx
import { List, ReferenceField, NumberField } from "@/components/admin";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { DetailItemCard } from "@/components/forms";

export const PoOrderList = () => (
  <List>
    <ResponsiveDataTable
      mobileConfig={{
        customCard: (record) => (
          <DetailItemCard showEditAction={false} showDeleteAction={false}>
            <div className="space-y-1">
              <div className="text-sm font-semibold">{record.titulo}</div>
              <div className="text-xs text-muted-foreground">
                Solicitante: {record.solicitante_id}
              </div>
              <div className="text-xs text-muted-foreground">
                Tipo: {record.tipo_solicitud_id}
              </div>
              <div className="text-xs text-muted-foreground">
                Proveedor: {record.proveedor_id}
              </div>
              <div className="text-xs">
                Importe: {record.total}
              </div>
            </div>
          </DetailItemCard>
        ),
      }}
    >
      <ResponsiveDataTable.Col source="id" />
      <ResponsiveDataTable.Col source="titulo" />
      <ResponsiveDataTable.Col label="Solicitante">
        <ReferenceField source="solicitante_id" reference="users" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col label="Tipo solicitud">
        <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col label="Proveedor">
        <ReferenceField source="proveedor_id" reference="proveedores" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col label="Importe">
        <NumberField source="total" />
      </ResponsiveDataTable.Col>
    </ResponsiveDataTable>
  </List>
);
```

**Responsive (extras)**
- Cabecera en grilla: envolver los inputs en un contenedor con clases
  `grid gap-4 md:grid-cols-2 xl:grid-cols-3` para evitar una columna larga en desktop.
- Detalle inline en mobile: mantener `flex-col` en `sm` y usar `sm:flex-row` para desktop,
  de modo que cada detalle se apile en mobile.
- Inputs numéricos: setear `inputMode="decimal"` y `step` en `NumberInput`
  para teclado numérico y precisión correcta.
- Acciones sticky en mobile: usar un `Toolbar` o contenedor con `sticky bottom-0`
  para mantener accesible Guardar/Cancelar cuando el formulario es largo.

**Form (cabecera + detalle inline)**
Standard kit pattern: `SimpleForm` + `ReferenceInput` + `ArrayInput`.
```tsx
import {

  SimpleForm,

  TextInput,

  NumberInput,

  NumberField,

  DateInput,

  ReferenceInput,

  AutocompleteInput,

  ArrayInput,

  SimpleFormIterator,

  SelectInput,

} from "@/components/admin";

import { useEffect, useRef, useState } from "react";

import { useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";

import { FormDataConsumer } from "ra-core";

import { Confirm } from "@/components/confirm";

import { usePoOrderDefaults, useTipoSolicitudChangeGuard } from "./form_hooks";



const unidadMedidaChoices = [

  { id: "UN", name: "Unidad" },

  { id: "KG", name: "Kilogramo" },

  { id: "LT", name: "Litro" },

];



export const PoOrderForm = () => (

  <SimpleForm>

    <PoOrderFormFields />

  </SimpleForm>

);



const PoOrderFormFields = () => {

  usePoOrderDefaults();

  const { articuloFilter, confirmOpen, confirmChange, cancelChange } =

    useTipoSolicitudChangeGuard();



  return (

    <>

      <TextInput source="titulo" />

      <ReferenceInput source="solicitante_id" reference="users">

        <AutocompleteInput optionText="nombre" />

      </ReferenceInput>

      <ReferenceInput source="tipo_solicitud_id" reference="tipos-solicitud">

        <AutocompleteInput optionText="nombre" />

      </ReferenceInput>

      <ReferenceInput source="departamento_id" reference="departamentos">

        <AutocompleteInput optionText="nombre" />

      </ReferenceInput>

      <ReferenceInput source="order_status_id" reference="po-order-status">

        <AutocompleteInput optionText="nombre" />

      </ReferenceInput>

      <ReferenceInput source="proveedor_id" reference="proveedores">

        <AutocompleteInput optionText="nombre" />

      </ReferenceInput>

      <DateInput source="fecha_necesidad" />

      {/* total is calculated from detalles */}

      <CalculatedTotal />



      {/* Optional fields block, hidden by default */}

      {/* Use a local toggle (useState) to show/hide additional fields */}

      {/* Examples: centro_costo_id, oportunidad_id, comentario */}

      <OptionalFields />



      {/* Fixed-height detail list with vertical scroll (desktop only) */}

      <DetalleScrollable articuloFilter={articuloFilter} />



      <Confirm

        isOpen={confirmOpen}

        title="Cambiar tipo de solicitud"

        content="Esto limpiar? los art?culos seleccionados. ?Deseas continuar?"

        onConfirm={confirmChange}

        onClose={cancelChange}

      />

    </>

  );

};





const DetalleScrollable = ({

  articuloFilter,

}: {

  articuloFilter?: Record<string, unknown>;

}) => {

  const containerRef = useRef<HTMLDivElement | null>(null);

  const detalles = useWatch({ name: "detalles" }) as unknown[] | undefined;

  const prevLengthRef = useRef<number>(detalles?.length ?? 0);



  // Auto-scroll to the last item when "Agregar" adds a new row

  useEffect(() => {

    const length = detalles?.length ?? 0;

    if (length > prevLengthRef.current && containerRef.current) {

      containerRef.current.scrollTop = containerRef.current.scrollHeight;

    }

    prevLengthRef.current = length;

  }, [detalles?.length]);



  return (

    <div

      ref={containerRef}

      className="rounded-md border border-border p-2 md:max-h-80 md:overflow-y-auto"

    >

      <ArrayInput source="detalles">

        <SimpleFormIterator inline>

          {/* Wrap main fields + optional block to render optional fields below the row */}

          <div className="flex w-full flex-col gap-2">

            <div className="flex flex-col gap-2 sm:flex-row">

              {/* Hidden id to allow updates of existing detail rows */}

              <TextInput source="id" type="hidden" label={false} />

              <ReferenceInput

                source="articulo_id"

                reference="articulos"

                filter={articuloFilter}

              >

                <AutocompleteInput optionText="nombre" />

              </ReferenceInput>

              <TextInput source="descripcion" />

              <NumberInput source="cantidad" />

              <NumberInput source="precio" />

              {/* importe is calculated = cantidad * precio, not editable */}

              <CalculatedImporte />

            </div>

            <DetalleOptionalFields />

          </div>

        </SimpleFormIterator>

      </ArrayInput>

    </div>

  );

};



const OptionalFields = () => {

  const [showOptional, setShowOptional] = useState(false);

  return (

    <div>

      <Button

        type="button"

        variant="outline"

        size="sm"

        onClick={() => setShowOptional((v) => !v)}

      >

        {showOptional ? "Ocultar campos" : "Mostrar campos"}

      </Button>

      {showOptional ? (

        <div>

          <ReferenceInput source="centro_costo_id" reference="centros-costo">

            <AutocompleteInput optionText="nombre" />

          </ReferenceInput>

          <ReferenceInput source="oportunidad_id" reference="crm/oportunidades">

            <AutocompleteInput optionText="titulo" />

          </ReferenceInput>

          <TextInput source="comentario" multiline />

        </div>

      ) : null}

    </div>

  );

};



const DetalleOptionalFields = () => {

  const [showOptional, setShowOptional] = useState(false);

  return (

    <div className="w-full">

      <Button

        type="button"

        variant="ghost"

        size="sm"

        onClick={() => setShowOptional((v) => !v)}

      >

        {showOptional ? "Ocultar detalle" : "Mostrar detalle"}

      </Button>

      {showOptional ? (

        <div className="mt-2">

          {/* Optional detail fields from the model */}

          <SelectInput source="unidad_medida" choices={unidadMedidaChoices} />

        </div>

      ) : null}

    </div>

  );

};



const CalculatedTotal = () => (

  <FormDataConsumer>

    {({ formData }) => {

      const detalles = Array.isArray(formData?.detalles) ? formData.detalles : [];

      const total = detalles.reduce((acc, d) => {

        const cantidad = Number(d?.cantidad ?? 0);

        const precio = Number(d?.precio ?? 0);

        const importe = Number.isFinite(d?.importe)

          ? Number(d.importe)

          : Number((cantidad * precio).toFixed(2));

        return acc + (Number.isFinite(importe) ? importe : 0);

      }, 0);

      return (

        <NumberField

          source="total"

          record={{ total: Number(total.toFixed(2)) }}

          options={{ style: "currency", currency: "ARS" }} // adjust currency as needed

        />

      );

    }}

  </FormDataConsumer>

);

```

**Defaults (reglas adicionales)**
- `solicitante_id`: asumir por defecto el usuario logueado.
- `departamento_id`: asumir por defecto el departamento del solicitante.
- `centro_costo_id`: asumir por defecto el centro de costo del departamento.

Implementación recomendada: en `form_hooks.ts` usar `useGetIdentity()` para obtener el usuario,
precargar `solicitante_id`, luego cargar el `departamento_id` asociado y finalmente el
`centro_costo_id` por departamento. Mantener `setValue` con `shouldDirty: false` para no ensuciar el form.

```tsx
// form_hooks.ts
import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useGetIdentity, useDataProvider } from "ra-core";

export const usePoOrderDefaults = () => {
  const { data: identity } = useGetIdentity();
  const { setValue } = useFormContext();
  const dataProvider = useDataProvider();
  const defaultsApplied = useRef(false);

  const solicitanteId = useWatch({ name: "solicitante_id" }) as number | undefined;

  useEffect(() => {
    if (defaultsApplied.current) return;
    if (!identity?.id) return;
    setValue("solicitante_id", identity.id, { shouldDirty: false });
    defaultsApplied.current = true;
  }, [identity?.id, setValue]);

  useEffect(() => {
    if (!solicitanteId) return;
    let active = true;
    (async () => {
      const { data: usuario } = await dataProvider.getOne("users", { id: solicitanteId });
      if (!active) return;
      if (usuario?.departamento_id) {
        setValue("departamento_id", usuario.departamento_id, { shouldDirty: false });
        const { data: depto } = await dataProvider.getOne("departamentos", {
          id: usuario.departamento_id,
        });
        if (!active) return;
        if (depto?.centro_costo_id) {
          setValue("centro_costo_id", depto.centro_costo_id, { shouldDirty: false });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [solicitanteId, dataProvider, setValue]);
};
```

**Tipo de solicitud: confirmación + filtro dinámico + limpieza de detalle**
La lógica vive en un hook de formulario (ej: `form_hooks.ts`) y el popup se muestra en `form.tsx`.
```tsx
// form_hooks.ts

import { useEffect, useRef, useState } from "react";

import { useFormContext, useWatch } from "react-hook-form";



export const useTipoSolicitudChangeGuard = () => {

  const { setValue } = useFormContext();

  const tipoSolicitudId = useWatch({ name: "tipo_solicitud_id" });

  const detalles = useWatch({ name: "detalles" }) as any[] | undefined;



  const prevTipoRef = useRef(tipoSolicitudId);

  const [pendingTipo, setPendingTipo] = useState<string | undefined>();

  const [confirmOpen, setConfirmOpen] = useState(false);



  const articuloFilter =

    tipoSolicitudId ? { tipo_solicitud_id: tipoSolicitudId } : {};



  useEffect(() => {

    if (prevTipoRef.current === tipoSolicitudId) return;

    const hasDetalles = (detalles ?? []).length > 0;



    if (hasDetalles) {

      setPendingTipo(tipoSolicitudId);

      setConfirmOpen(true);

      // revert until user confirms

      setValue("tipo_solicitud_id", prevTipoRef.current, { shouldDirty: false });

      return;

    }



    prevTipoRef.current = tipoSolicitudId;

  }, [tipoSolicitudId, detalles, setValue]);



  const confirmChange = () => {

    setConfirmOpen(false);

    prevTipoRef.current = pendingTipo;

    setValue("tipo_solicitud_id", pendingTipo, { shouldDirty: true });

    setValue("detalles", [], { shouldDirty: true });

  };



  const cancelChange = () => {

    setConfirmOpen(false);

    setPendingTipo(undefined);

  };



  return { articuloFilter, confirmOpen, confirmChange, cancelChange };

};

```



**Calculated importe (cantidad * precio)**

Standard kit way: render a read-only computed field, and compute the final

value in the `transform` of `<Create>` / `<Edit>` before sending the payload.

```tsx

const CalculatedImporte = () => (

  <FormDataConsumer>

    {({ scopedFormData }) => {

      const cantidad = Number(scopedFormData?.cantidad ?? 0);

      const precio = Number(scopedFormData?.precio ?? 0);

      const importe = Number((cantidad * precio).toFixed(2));

      return <NumberField source="importe" record={{ importe }} />;

    }}

  </FormDataConsumer>

);

```

Then, in `Create` / `Edit`:

```tsx

<Create transform={(data) => ({

  ...data,

  detalles: (data.detalles ?? []).map((d) => ({

    ...d,

    importe: Number((Number(d.cantidad ?? 0) * Number(d.precio ?? 0)).toFixed(2)),

  })),

  total: Number(

    (data.detalles ?? []).reduce((acc, d) => {

      const importe = Number((Number(d.cantidad ?? 0) * Number(d.precio ?? 0)).toFixed(2));

      return acc + (Number.isFinite(importe) ? importe : 0);

    }, 0).toFixed(2)

  ),

})}>

  <PoOrderForm />

</Create>

```



**Zod validations**

Define the schema in `model.ts`, then import it in the form and pass a `resolver` to `SimpleForm`.

Use `z.coerce.number()` because React Admin inputs often provide strings.

`model.ts` should live in the same folder as `List.tsx`, `form.tsx`, `create.tsx`, `edit.tsx`, and `show.tsx`.

```tsx

// model.ts

import { z } from "zod";



const requiredId = z.preprocess(

  (v) => (v === "" || v === null ? undefined : v),

  z.coerce.number().int().positive()

);

const optionalId = z.preprocess(

  (v) => (v === "" || v === null ? undefined : v),

  z.coerce.number().int().positive().optional()

);



export const poOrderDetalleSchema = z.object({

  id: optionalId,

  articulo_id: optionalId,

  descripcion: z.string().min(1).max(500),

  unidad_medida: z.string().max(50).optional(),

  cantidad: z.coerce.number().min(0),

  precio: z.coerce.number().min(0),

  importe: z.coerce.number().min(0),

}).superRefine((val, ctx) => {

  const expected = Number((val.cantidad * val.precio).toFixed(2));

  if (Number.isFinite(expected) && Number(val.importe ?? 0) !== expected) {

    ctx.addIssue({

      code: z.ZodIssueCode.custom,

      path: ["importe"],

      message: "El importe debe ser cantidad * precio",

    });

  }

});



export const poOrderSchema = z.object({

  titulo: z.string().min(1).max(200),

  solicitante_id: requiredId,

  tipo_solicitud_id: requiredId,

  departamento_id: requiredId,

  order_status_id: requiredId,

  proveedor_id: optionalId,

  centro_costo_id: optionalId,

  oportunidad_id: optionalId,

  fecha_necesidad: z.string().optional(),

  comentario: z.string().max(1000).optional(),

  total: z.coerce.number().min(0),

  detalles: z.array(poOrderDetalleSchema).min(1),

});

```



```tsx

// form.tsx

import { zodResolver } from "@hookform/resolvers/zod";

import { SimpleForm } from "@/components/admin";

import { poOrderSchema } from "./model";



export const PoOrderForm = () => (

  <SimpleForm resolver={zodResolver(poOrderSchema)}>

    {/* fields */}

    </SimpleForm>

);

```



**Create / Edit**

```tsx

import { Create, Edit } from "@/components/admin";

import { PoOrderForm } from "./form";



export const PoOrderCreate = () => (

  <Create>

    <PoOrderForm />

  </Create>

);



export const PoOrderEdit = () => (

  <Edit>

    <PoOrderForm />

  </Edit>

);

```



**Show**

```tsx

import { Show, SimpleShowLayout, TextField, ReferenceField, NumberField } from "@/components/admin";



export const PoOrderShow = () => (

  <Show>

    <SimpleShowLayout>

      <TextField source="titulo" />

      <ReferenceField source="solicitante_id" reference="users" />

      <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud" />

      <ReferenceField source="proveedor_id" reference="proveedores" />

      <NumberField source="total" />

    </SimpleShowLayout>

  </Show>

);

```



**Nested payload shape (expected)**

```json

{

  "titulo": "OC-001",

  "solicitante_id": 10,

  "tipo_solicitud_id": 2,

  "departamento_id": 3,

  "order_status_id": 1,

  "proveedor_id": 5,

  "fecha_necesidad": "2026-02-07",

  "total": 1200.50,

  "detalles": [

    {

      "articulo_id": 99,

      "descripcion": "Insumo",

      "cantidad": 2,

      "precio": 300.00,

      "importe": 600.00

    }

  ]

}

```



**Notes**

- This is the standard Shadcn Admin Kit flow. No custom wrappers, no repo-specific

  form sections or detail engines.

- If the backend expects numeric fields, keep `NumberInput` so values are numbers.

- `order_status_id` is required in the backend. On create, prefill it (e.g. the status

  with `es_inicial=true`) or force user selection.

- Component names can be `PoOrder*` while the REST resource is `po-orders`.

- Include hidden `detalles[].id` in edit forms so the backend can update existing rows

  instead of recreating them.

