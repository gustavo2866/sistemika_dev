# 📝 Requerimientos Frontend - Completar Modelo Solicitudes

> **Referencia Backend:** [20251107_bk_solicitudes_spec.md](./20251107_bk_solicitudes_spec.md)  
> **Versión:** 1.0  
> **Fecha:** 2025-11-10

---

## ⚠️ INSTRUCCIONES DE USO

1. Este documento define los cambios de frontend para reflejar la refactorización del modelo Solicitudes
2. **Seguir patrones establecidos** en `frontend/src/app/resources/`
3. Respetar estructura de archivos: `model.ts`, `form.tsx`, `List.tsx`, `create.tsx`, `edit.tsx`
4. Consultar recursos existentes como referencia (articulos, proveedores, users)

---

## 📋 METADATA DEL CAMBIO

| Campo | Valor |
|-------|-------|
| **ID del Cambio** | `FE-2025-001` |
| **Título** | `Adaptar frontend Solicitudes a nuevo modelo (Tipos, Departamentos, Estados)` |
| **Tipo** | `[x] Modificar Entidad  [x] Nuevos Recursos  [ ] Refactor  [ ] Bugfix` |
| **Prioridad** | `[ ] Crítica  [x] Alta  [ ] Media  [ ] Baja` |
| **Fecha Creación** | `2025-11-10` |
| **Autor** | `Gustavo` |
| **Estimación** | `6 horas` |
| **Estado** | `[ ] Planificado  [x] En Desarrollo  [ ] Testing  [ ] Completado` |
| **Depende de Backend** | `CHG-2025-001` (completado ✅) |

---

## 1. RESUMEN EJECUTIVO

Adaptar el módulo de Solicitudes en el frontend para reflejar los cambios del backend:

1. **Crear recursos nuevos**: `departamentos` y `tipos-solicitud` (CRUD completo)
2. **Modificar formulario de Solicitudes**: 
   - Reemplazar campo `tipo` (select local) por `tipo_solicitud_id` (referencia a API)
   - Agregar campo `departamento_id` (referencia a API)
   - Agregar campo `estado` (select local)
   - Agregar campo `total` (solo lectura)
3. **Implementar lógica de defaults**: Al seleccionar tipo de solicitud, sugerir departamento y artículo por defecto
4. **Actualizar listado**: Mostrar nuevos campos y permitir filtrado por tipo/departamento/estado
5. **Mantener compatibilidad**: Asegurar que solicitudes existentes se muestren correctamente

**Impacto:** Alto - Cambio estructural en formulario principal y creación de 2 módulos CRUD completos

---

## 2. NUEVOS RECURSOS (MÓDULOS CRUD)

### 2.1 Recurso: Departamentos

**Ubicación:** `frontend/src/app/resources/departamentos/`

**Archivos a crear:**
- `model.ts` - Modelo de datos y validaciones
- `List.tsx` - Tabla de listado
- `form.tsx` - Formulario compartido (create/edit)
- `create.tsx` - Página de creación
- `edit.tsx` - Página de edición
- `index.ts` - Exports públicos

#### 2.1.1 Modelo (`model.ts`)

```typescript
// frontend/src/app/resources/departamentos/model.ts

import { createEntitySchema, stringField } from "@/lib/form-detail-schema";

// ============================================
// 1. CONFIGURACIÓN
// ============================================

export const VALIDATION_RULES = {
  NOMBRE: {
    MAX_LENGTH: 100,
    MIN_LENGTH: 3,
  },
  DESCRIPCION: {
    MAX_LENGTH: 500,
  },
} as const;

// ============================================
// 2. TIPOS
// ============================================

export type Departamento = {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type DepartamentoFormValues = {
  nombre: string;
  descripcion?: string;
  activo: boolean;
};

// ============================================
// 3. VALIDACIONES (Zod Schema)
// ============================================

export const departamentoSchema = createEntitySchema({
  nombre: stringField({
    required: true,
    minLength: VALIDATION_RULES.NOMBRE.MIN_LENGTH,
    maxLength: VALIDATION_RULES.NOMBRE.MAX_LENGTH,
    label: "Nombre del departamento",
  }),
  descripcion: stringField({
    required: false,
    maxLength: VALIDATION_RULES.DESCRIPCION.MAX_LENGTH,
    label: "Descripción",
  }),
});

// ============================================
// 4. VALORES DEFAULT
// ============================================

export const DEPARTAMENTO_DEFAULT: DepartamentoFormValues = {
  nombre: "",
  descripcion: "",
  activo: true,
};
```

#### 2.1.2 Listado (`List.tsx`)

```typescript
// frontend/src/app/resources/departamentos/List.tsx

"use client";

import { Datagrid, List as RaList, TextField, BooleanField } from "react-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListActions } from "@/components/list-actions";

export const List = () => (
  <Card>
    <CardHeader>
      <CardTitle>Departamentos</CardTitle>
    </CardHeader>
    <CardContent>
      <RaList
        actions={<ListActions hasCreate />}
        perPage={25}
        sort={{ field: "nombre", order: "ASC" }}
      >
        <Datagrid rowClick="edit" bulkActionButtons={false}>
          <TextField source="nombre" label="Nombre" />
          <TextField source="descripcion" label="Descripción" />
          <BooleanField source="activo" label="Activo" />
        </Datagrid>
      </RaList>
    </CardContent>
  </Card>
);
```

#### 2.1.3 Formulario (`form.tsx`)

```typescript
// frontend/src/app/resources/departamentos/form.tsx

"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { required } from "ra-core";
import { VALIDATION_RULES } from "./model";

export const Form = () => (
  <SimpleForm>
    <TextInput
      source="nombre"
      label="Nombre del departamento"
      validate={required()}
      className="w-full"
      fullWidth
    />
    <TextInput
      source="descripcion"
      label="Descripción"
      multiline
      rows={3}
      className="w-full"
      fullWidth
    />
    <BooleanInput
      source="activo"
      label="Departamento activo"
      defaultValue={true}
    />
  </SimpleForm>
);
```

#### 2.1.4 Create y Edit

```typescript
// frontend/src/app/resources/departamentos/create.tsx
"use client";
import { Create } from "react-admin";
import { Form } from "./form";

export default function DepartamentoCreate() {
  return (
    <Create>
      <Form />
    </Create>
  );
}

// frontend/src/app/resources/departamentos/edit.tsx
"use client";
import { Edit } from "react-admin";
import { Form } from "./form";

export default function DepartamentoEdit() {
  return (
    <Edit>
      <Form />
    </Edit>
  );
}
```

#### 2.1.5 Index

```typescript
// frontend/src/app/resources/departamentos/index.ts

export { List } from "./List";
export { default as DepartamentoCreate } from "./create";
export { default as DepartamentoEdit } from "./edit";
export * from "./model";
```

---

### 2.2 Recurso: Tipos de Solicitud

**Ubicación:** `frontend/src/app/resources/tipos-solicitud/`

**Archivos a crear:**
- `model.ts` - Modelo de datos y validaciones
- `List.tsx` - Tabla de listado con relaciones expandidas
- `form.tsx` - Formulario con referencias a artículos y departamentos
- `create.tsx` - Página de creación
- `edit.tsx` - Página de edición
- `index.ts` - Exports públicos

#### 2.2.1 Modelo (`model.ts`)

```typescript
// frontend/src/app/resources/tipos-solicitud/model.ts

import { createEntitySchema, stringField, referenceField } from "@/lib/form-detail-schema";

// ============================================
// 1. CONFIGURACIÓN
// ============================================

export const VALIDATION_RULES = {
  NOMBRE: {
    MAX_LENGTH: 100,
    MIN_LENGTH: 3,
  },
  DESCRIPCION: {
    MAX_LENGTH: 500,
  },
  TIPO_ARTICULO_FILTER: {
    MAX_LENGTH: 100,
  },
} as const;

// Referencias para ComboboxQuery
export const ARTICULOS_REFERENCE = {
  resource: "articulos",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;

export const DEPARTAMENTOS_REFERENCE = {
  resource: "departamentos",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000,
} as const;

// ============================================
// 2. TIPOS
// ============================================

export type TipoSolicitud = {
  id: number;
  nombre: string;
  descripcion?: string;
  tipo_articulo_filter?: string;
  articulo_default_id?: number;
  departamento_default_id?: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
  
  // Relaciones expandidas (cuando se incluyen con __expanded_list_relations__)
  articulo_default?: {
    id: number;
    nombre: string;
  };
  departamento_default?: {
    id: number;
    nombre: string;
  };
};

export type TipoSolicitudFormValues = {
  nombre: string;
  descripcion?: string;
  tipo_articulo_filter?: string;
  articulo_default_id?: string; // string para ComboboxQuery
  departamento_default_id?: string; // string para ComboboxQuery
  activo: boolean;
};

// ============================================
// 3. VALIDACIONES (Zod Schema)
// ============================================

export const tipoSolicitudSchema = createEntitySchema({
  nombre: stringField({
    required: true,
    minLength: VALIDATION_RULES.NOMBRE.MIN_LENGTH,
    maxLength: VALIDATION_RULES.NOMBRE.MAX_LENGTH,
    label: "Nombre del tipo",
  }),
  descripcion: stringField({
    required: false,
    maxLength: VALIDATION_RULES.DESCRIPCION.MAX_LENGTH,
    label: "Descripción",
  }),
  tipo_articulo_filter: stringField({
    required: false,
    maxLength: VALIDATION_RULES.TIPO_ARTICULO_FILTER.MAX_LENGTH,
    label: "Filtro de tipo de artículo",
  }),
  articulo_default_id: referenceField({
    required: false,
    label: "Artículo sugerido por defecto",
  }),
  departamento_default_id: referenceField({
    required: false,
    label: "Departamento sugerido por defecto",
  }),
});

// ============================================
// 4. VALORES DEFAULT
// ============================================

export const TIPO_SOLICITUD_DEFAULT: TipoSolicitudFormValues = {
  nombre: "",
  descripcion: "",
  tipo_articulo_filter: "",
  articulo_default_id: undefined,
  departamento_default_id: undefined,
  activo: true,
};
```

#### 2.2.2 Listado (`List.tsx`)

```typescript
// frontend/src/app/resources/tipos-solicitud/List.tsx

"use client";

import { Datagrid, List as RaList, TextField, BooleanField, ReferenceField } from "react-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListActions } from "@/components/list-actions";

export const List = () => (
  <Card>
    <CardHeader>
      <CardTitle>Tipos de Solicitud</CardTitle>
    </CardHeader>
    <CardContent>
      <RaList
        actions={<ListActions hasCreate />}
        perPage={25}
        sort={{ field: "nombre", order: "ASC" }}
      >
        <Datagrid rowClick="edit" bulkActionButtons={false}>
          <TextField source="nombre" label="Nombre" />
          <TextField source="descripcion" label="Descripción" />
          <TextField source="tipo_articulo_filter" label="Filtro Artículo" />
          <ReferenceField
            source="departamento_default_id"
            reference="departamentos"
            label="Depto. Default"
            link={false}
          >
            <TextField source="nombre" />
          </ReferenceField>
          <BooleanField source="activo" label="Activo" />
        </Datagrid>
      </RaList>
    </CardContent>
  </Card>
);
```

#### 2.2.3 Formulario (`form.tsx`)

```typescript
// frontend/src/app/resources/tipos-solicitud/form.tsx

"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { ComboboxQuery, FormField } from "@/components/forms";
import { required } from "ra-core";
import { useFormContext } from "react-hook-form";
import { 
  ARTICULOS_REFERENCE, 
  DEPARTAMENTOS_REFERENCE,
  type TipoSolicitudFormValues 
} from "./model";

export const Form = () => {
  const form = useFormContext<TipoSolicitudFormValues>();

  return (
    <SimpleForm>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput
          source="nombre"
          label="Nombre del tipo"
          validate={required()}
          className="w-full md:col-span-2"
          fullWidth
        />
        
        <TextInput
          source="descripcion"
          label="Descripción"
          multiline
          rows={3}
          className="w-full md:col-span-2"
          fullWidth
        />
        
        <TextInput
          source="tipo_articulo_filter"
          label="Filtro de tipo artículo (ej: Material, Ferreteria)"
          helperText="Filtra artículos por tipo_articulo. Dejar vacío para mostrar todos."
          className="w-full md:col-span-2"
          fullWidth
        />
        
        <FormField
          label="Artículo sugerido por defecto"
          helperText="Artículo que se pre-seleccionará al agregar detalles (opcional)"
        >
          <ComboboxQuery
            {...ARTICULOS_REFERENCE}
            value={form.watch("articulo_default_id") || ""}
            onChange={(value: string) =>
              form.setValue("articulo_default_id", value || undefined, {
                shouldValidate: true,
              })
            }
            placeholder="Selecciona un artículo (opcional)"
          />
        </FormField>
        
        <FormField
          label="Departamento sugerido por defecto"
          helperText="Departamento que se pre-seleccionará al crear solicitud (opcional)"
        >
          <ComboboxQuery
            {...DEPARTAMENTOS_REFERENCE}
            value={form.watch("departamento_default_id") || ""}
            onChange={(value: string) =>
              form.setValue("departamento_default_id", value || undefined, {
                shouldValidate: true,
              })
            }
            placeholder="Selecciona un departamento (opcional)"
          />
        </FormField>
        
        <BooleanInput
          source="activo"
          label="Tipo activo"
          defaultValue={true}
          className="md:col-span-2"
        />
      </div>
    </SimpleForm>
  );
};
```

#### 2.2.4 Create, Edit, Index

```typescript
// frontend/src/app/resources/tipos-solicitud/create.tsx
"use client";
import { Create } from "react-admin";
import { Form } from "./form";

export default function TipoSolicitudCreate() {
  return (
    <Create>
      <Form />
    </Create>
  );
}

// frontend/src/app/resources/tipos-solicitud/edit.tsx
"use client";
import { Edit } from "react-admin";
import { Form } from "./form";

export default function TipoSolicitudEdit() {
  return (
    <Edit>
      <Form />
    </Edit>
  );
}

// frontend/src/app/resources/tipos-solicitud/index.ts
export { List } from "./List";
export { default as TipoSolicitudCreate } from "./create";
export { default as TipoSolicitudEdit } from "./edit";
export * from "./model";
```

---

## 3. MODIFICACIONES A SOLICITUDES

### 3.1 Modificar `model.ts`

**Ubicación:** `frontend/src/app/resources/solicitudes/model.ts`

**Cambios requeridos:**

```typescript
// frontend/src/app/resources/solicitudes/model.ts

// ============================================
// 1. CONFIGURACIÓN - ACTUALIZAR
// ============================================

// ❌ ELIMINAR: export const TIPO_CHOICES = [...]
// ✅ AGREGAR:

/**
 * Estados posibles de una solicitud
 */
export const ESTADO_CHOICES = [
  { id: "pendiente", name: "Pendiente" },
  { id: "aprobada", name: "Aprobada" },
  { id: "rechazada", name: "Rechazada" },
  { id: "en_proceso", name: "En Proceso" },
  { id: "finalizada", name: "Finalizada" },
];

/**
 * Referencias para ComboboxQuery
 */
export const TIPOS_SOLICITUD_REFERENCE = {
  resource: "tipos-solicitud",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000, // 10 minutos - los tipos cambian poco
} as const;

export const DEPARTAMENTOS_REFERENCE = {
  resource: "departamentos",
  labelField: "nombre",
  limit: 50,
  staleTime: 10 * 60 * 1000,
} as const;

// Mantener ARTICULOS_REFERENCE y USERS_REFERENCE existentes...

// ============================================
// 2. TIPOS - ACTUALIZAR
// ============================================

/**
 * Solicitud completa (formato API)
 */
export type Solicitud = {
  id: number;
  tipo_solicitud_id: number;        // ✅ NUEVO - FK a tipos_solicitud
  departamento_id: number;          // ✅ NUEVO - FK a departamentos
  estado: string;                   // ✅ NUEVO - enum EstadoSolicitud
  total: number;                    // ✅ NUEVO - monto total
  fecha_necesidad: string;
  comentario?: string;
  solicitante_id: number;
  created_at: string;
  updated_at: string;
  
  // Relaciones expandidas
  detalles: SolicitudDetalle[];
  solicitante?: {
    id: number;
    nombre: string;
    email: string;
  };
  tipo_solicitud?: {                // ✅ NUEVO
    id: number;
    nombre: string;
    tipo_articulo_filter?: string;
    articulo_default_id?: number;
  };
  departamento?: {                  // ✅ NUEVO
    id: number;
    nombre: string;
  };
};

/**
 * Valores del formulario
 */
export type SolicitudFormValues = {
  tipo_solicitud_id: string;        // ✅ CAMBIO: antes era "tipo" string local
  departamento_id: string;          // ✅ NUEVO
  estado: string;                   // ✅ NUEVO
  fecha_necesidad: string;
  comentario?: string;
  solicitante_id: string;
  detalles: DetalleFormValues[];
};

// ============================================
// 3. VALORES DEFAULT - ACTUALIZAR
// ============================================

export const solicitudCabeceraSchema = createEntitySchema({
  tipo_solicitud_id: referenceField({  // ✅ CAMBIO: antes era selectField "tipo"
    required: true,
    label: "Tipo de solicitud",
  }),
  departamento_id: referenceField({    // ✅ NUEVO
    required: true,
    label: "Departamento",
  }),
  estado: selectField({                // ✅ NUEVO
    required: false,
    label: "Estado",
    defaultValue: "pendiente",
  }),
  fecha_necesidad: stringField({
    required: true,
    label: "Fecha de necesidad",
  }),
  solicitante_id: referenceField({
    required: true,
    label: "Solicitante",
  }),
  comentario: stringField({
    required: false,
    maxLength: VALIDATION_RULES.GENERAL.MAX_COMENTARIO_LENGTH,
    label: "Comentarios",
  }),
});

// ============================================
// 4. HELPERS - AGREGAR
// ============================================

/**
 * Obtiene el filtro de artículos según el tipo de solicitud seleccionado
 */
export const getArticuloFilterByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: TipoSolicitud[] | undefined
): string | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  
  const tipo = tiposSolicitud.find(t => t.id === parseInt(tipoSolicitudId));
  return tipo?.tipo_articulo_filter;
};

/**
 * Obtiene el departamento default según el tipo de solicitud
 */
export const getDepartamentoDefaultByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: TipoSolicitud[] | undefined
): string | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  
  const tipo = tiposSolicitud.find(t => t.id === parseInt(tipoSolicitudId));
  return tipo?.departamento_default_id?.toString();
};

/**
 * Obtiene el artículo default según el tipo de solicitud
 */
export const getArticuloDefaultByTipo = (
  tipoSolicitudId: string | undefined,
  tiposSolicitud: TipoSolicitud[] | undefined
): string | undefined => {
  if (!tipoSolicitudId || !tiposSolicitud) return undefined;
  
  const tipo = tiposSolicitud.find(t => t.id === parseInt(tipoSolicitudId));
  return tipo?.articulo_default_id?.toString();
};
```

---

### 3.2 Modificar `form.tsx`

**Ubicación:** `frontend/src/app/resources/solicitudes/form.tsx`

**Cambios principales:**

1. Reemplazar `SelectInput` de "tipo" por `ComboboxQuery` para "tipo_solicitud_id"
2. Agregar `ComboboxQuery` para "departamento_id"
3. Agregar `SelectInput` para "estado"
4. Implementar lógica de defaults al cambiar tipo de solicitud
5. Filtrar artículos según `tipo_articulo_filter` del tipo seleccionado

```typescript
// frontend/src/app/resources/solicitudes/form.tsx

"use client";

import { useMemo, useEffect } from "react";
import { required } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { SimpleForm } from "@/components/simple-form";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ComboboxQuery,
  FormLayout,
  FormField,
  FormChoiceSelect,
  FormSimpleSection,
  FormDetailSection,
  FormDetailSectionAddButton,
  FormDetailCardList,
  FormDetailCard,
  FormDetailSectionMinItems,
  FormDetailFormDialog,
  useAutoInitializeField,
  useFormDetailSectionContext,
} from "@/components/forms";
import {
  type Solicitud,
  type SolicitudDetalle,
  ESTADO_CHOICES,
  UNIDAD_MEDIDA_CHOICES,
  ARTICULOS_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  VALIDATION_RULES,
  solicitudCabeceraSchema,
  solicitudDetalleSchema,
  getArticuloFilterByTipo,
  getDepartamentoDefaultByTipo,
  getArticuloDefaultByTipo,
} from "./model";

const GENERAL_SUBTITLE_COMMENT_SNIPPET = 25;

const buildGeneralSubtitle = (
  id: number | undefined,
  tipoNombre: string | undefined,
  departamentoNombre: string | undefined,
  estado: string | undefined,
  comentario: string | undefined,
  comentarioSnippetLength: number = GENERAL_SUBTITLE_COMMENT_SNIPPET
): string => {
  const snippet = comentario ? comentario.slice(0, comentarioSnippetLength) : "";
  return [id, tipoNombre, departamentoNombre, estado, snippet]
    .filter(Boolean)
    .join(" - ") || "Sin datos";
};

const SolicitudDetalleCard = ({ item }: { item: SolicitudDetalle }) => {
  const { getReferenceLabel } = useFormDetailSectionContext();
  const articuloLabel =
    item.articulo_nombre ||
    getReferenceLabel("articulo_id", item.articulo_id) ||
    `ID: ${item.articulo_id}`;

  return (
    <FormDetailCard
      title={articuloLabel}
      subtitle={item.descripcion || "Artículo sin descripción"}
      meta={[
        { label: "Unidad", value: item.unidad_medida || "-" },
        { label: "Cantidad", value: item.cantidad },
      ]}
    />
  );
};

const SolicitudDetalleForm = ({ articuloFilter }: { articuloFilter?: string }) => {
  // Construir filtro dinámico para artículos según tipo de solicitud
  const articulosReferenceFiltered = useMemo(() => {
    if (!articuloFilter) return ARTICULOS_REFERENCE;
    
    return {
      ...ARTICULOS_REFERENCE,
      filter: { tipo_articulo: articuloFilter },
    };
  }, [articuloFilter]);

  return (
    <FormDetailFormDialog
      title={({ action }) =>
        action === "create" ? "Agregar artículo" : "Editar artículo"
      }
      description="Completa los datos del artículo para la solicitud."
    >
      {(detalleForm) => (
        <>
          <FormField
            label="Artículo"
            error={detalleForm.formState.errors.articulo_id}
            required
          >
            <ComboboxQuery
              {...articulosReferenceFiltered}
              value={detalleForm.watch("articulo_id")}
              onChange={(value: string) =>
                detalleForm.setValue("articulo_id", value, {
                  shouldValidate: true,
                })
              }
              placeholder="Selecciona un artículo"
            />
          </FormField>

          <FormField
            label="Descripción"
            error={detalleForm.formState.errors.descripcion}
            required
          >
            <Textarea rows={3} {...detalleForm.register("descripcion")} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormChoiceSelect
              label="Unidad de medida"
              error={detalleForm.formState.errors.unidad_medida}
              required
              choices={UNIDAD_MEDIDA_CHOICES}
              value={detalleForm.watch("unidad_medida")}
              onChange={(value) =>
                detalleForm.setValue("unidad_medida", value, {
                  shouldValidate: true,
                })
              }
              placeholder="Selecciona unidad"
            />

            <FormField
              label="Cantidad"
              error={detalleForm.formState.errors.cantidad}
              required
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                {...detalleForm.register("cantidad", { valueAsNumber: true })}
              />
            </FormField>
          </div>
        </>
      )}
    </FormDetailFormDialog>
  );
};

const SolicitudDetalleContent = ({ articuloFilter }: { articuloFilter?: string }) => (
  <>
    <FormDetailSectionAddButton label="Agregar artículo" />
    <FormDetailCardList<SolicitudDetalle>
      emptyMessage="Todavía no agregaste artículos."
    >
      {(item) => <SolicitudDetalleCard item={item} />}
    </FormDetailCardList>
    <FormDetailSectionMinItems itemName="artículo" />
    <SolicitudDetalleForm articuloFilter={articuloFilter} />
  </>
);

const DatosGeneralesContent = () => {
  const form = useFormContext<Solicitud>();
  
  // Cargar tipos de solicitud para obtener defaults
  const { data: tiposSolicitud } = useQuery({
    queryKey: ["tipos-solicitud"],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tipos-solicitud`);
      if (!response.ok) throw new Error("Error cargando tipos de solicitud");
      const data = await response.json();
      return data.value || [];
    },
  });
  
  const tipoSolicitudIdValue = useWatch({ 
    control: form.control, 
    name: "tipo_solicitud_id" 
  });
  
  // Auto-asignar departamento cuando cambia el tipo de solicitud
  useEffect(() => {
    if (!tipoSolicitudIdValue || !tiposSolicitud) return;
    
    const departamentoDefault = getDepartamentoDefaultByTipo(
      tipoSolicitudIdValue,
      tiposSolicitud
    );
    
    if (departamentoDefault) {
      form.setValue("departamento_id", departamentoDefault, {
        shouldValidate: false,
      });
    }
  }, [tipoSolicitudIdValue, tiposSolicitud, form]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        label="Tipo de solicitud"
        error={form.formState.errors.tipo_solicitud_id}
        required
        className="md:col-span-2"
      >
        <ComboboxQuery
          {...TIPOS_SOLICITUD_REFERENCE}
          value={form.watch("tipo_solicitud_id")}
          onChange={(value: string) =>
            form.setValue("tipo_solicitud_id", value, {
              shouldValidate: true,
            })
          }
          placeholder="Selecciona el tipo de solicitud"
        />
      </FormField>
      
      <FormField
        label="Departamento"
        error={form.formState.errors.departamento_id}
        required
        helperText="Se sugiere automáticamente según el tipo, pero puedes cambiarlo"
      >
        <ComboboxQuery
          {...DEPARTAMENTOS_REFERENCE}
          value={form.watch("departamento_id")}
          onChange={(value: string) =>
            form.setValue("departamento_id", value, {
              shouldValidate: true,
            })
          }
          placeholder="Selecciona el departamento"
        />
      </FormField>
      
      <FormChoiceSelect
        label="Estado"
        error={form.formState.errors.estado}
        choices={ESTADO_CHOICES}
        value={form.watch("estado")}
        onChange={(value) =>
          form.setValue("estado", value, {
            shouldValidate: true,
          })
        }
        placeholder="Selecciona el estado"
      />
      
      <TextInput
        source="fecha_necesidad"
        label="Fecha de necesidad"
        type="date"
        className="w-full"
        validate={required()}
      />
      
      <FormField
        label="Solicitante"
        error={form.formState.errors.solicitante_id}
        required
      >
        <ComboboxQuery
          {...{ resource: "users", labelField: "nombre" }}
          value={form.watch("solicitante_id")}
          onChange={(value: string) =>
            form.setValue("solicitante_id", value, {
              shouldValidate: true,
            })
          }
          placeholder="Selecciona el solicitante"
        />
      </FormField>
      
      <TextInput
        source="comentario"
        label="Comentarios"
        multiline
        rows={3}
        className="md:col-span-2"
      />
    </div>
  );
};

const SolicitudFormFields = () => {
  const form = useFormContext<Solicitud>();
  const { control } = form;
  
  const idValue = useWatch({ control, name: "id" });
  const tipoSolicitudIdValue = useWatch({ control, name: "tipo_solicitud_id" });
  const departamentoIdValue = useWatch({ control, name: "departamento_id" });
  const estadoValue = useWatch({ control, name: "estado" });
  const comentarioValue = useWatch({ control, name: "comentario" }) || "";

  // Cargar tipos de solicitud para obtener filtros
  const { data: tiposSolicitud } = useQuery({
    queryKey: ["tipos-solicitud"],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tipos-solicitud`);
      if (!response.ok) throw new Error("Error cargando tipos de solicitud");
      const data = await response.json();
      return data.value || [];
    },
  });
  
  // Obtener filtro de artículos según tipo seleccionado
  const articuloFilter = useMemo(() => {
    return getArticuloFilterByTipo(tipoSolicitudIdValue, tiposSolicitud);
  }, [tipoSolicitudIdValue, tiposSolicitud]);
  
  // Obtener nombres para subtitle
  const { data: departamentos } = useQuery({
    queryKey: ["departamentos"],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/departamentos`);
      if (!response.ok) throw new Error("Error");
      const data = await response.json();
      return data.value || [];
    },
  });
  
  const tipoNombre = tiposSolicitud?.find(
    t => t.id === parseInt(tipoSolicitudIdValue || "0")
  )?.nombre;
  
  const departamentoNombre = departamentos?.find(
    d => d.id === parseInt(departamentoIdValue || "0")
  )?.nombre;

  useAutoInitializeField("solicitante_id", "id", !idValue);

  const generalSubtitle = useMemo(
    () =>
      buildGeneralSubtitle(
        idValue,
        tipoNombre,
        departamentoNombre,
        estadoValue,
        comentarioValue,
        GENERAL_SUBTITLE_COMMENT_SNIPPET
      ),
    [idValue, tipoNombre, departamentoNombre, estadoValue, comentarioValue]
  );

  return (
    <FormLayout
      sections={[
        {
          id: "datos-generales",
          title: "Datos generales",
          subtitle: generalSubtitle,
          defaultOpen: !idValue,
          children: (
            <FormSimpleSection>
              <DatosGeneralesContent />
            </FormSimpleSection>
          ),
        },
        {
          id: "articulos",
          title: "Artículos seleccionados",
          subtitle: articuloFilter 
            ? `Filtrado por tipo: ${articuloFilter}` 
            : "Todos los artículos disponibles",
          defaultOpen: true,
          children: (
            <FormDetailSection
              name="detalles"
              schema={solicitudDetalleSchema}
              minItems={VALIDATION_RULES.DETALLE.MIN_ITEMS}
            >
              <SolicitudDetalleContent articuloFilter={articuloFilter} />
            </FormDetailSection>
          ),
        },
      ]}
    />
  );
};

export const Form = () => {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const cabeceraDefaults = useMemo(
    () => solicitudCabeceraSchema.defaults(),
    []
  );
  
  const defaultValues = useMemo(() => {
    const solicitanteDefault =
      cabeceraDefaults.solicitante_id &&
      cabeceraDefaults.solicitante_id.trim().length > 0
        ? Number(cabeceraDefaults.solicitante_id)
        : undefined;
    
    return {
      ...cabeceraDefaults,
      fecha_necesidad: cabeceraDefaults.fecha_necesidad || today,
      solicitante_id: solicitanteDefault,
      estado: "pendiente", // Estado default
      detalles: [],
    };
  }, [cabeceraDefaults, today]);

  return (
    <SimpleForm defaultValues={defaultValues}>
      <SolicitudFormFields />
    </SimpleForm>
  );
};
```

---

### 3.3 Modificar `List.tsx`

**Ubicación:** `frontend/src/app/resources/solicitudes/List.tsx`

**Cambios:**

```typescript
// frontend/src/app/resources/solicitudes/List.tsx

"use client";

import { 
  Datagrid, 
  List as RaList, 
  TextField, 
  DateField,
  ReferenceField,
  FunctionField,
} from "react-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListActions } from "@/components/list-actions";
import { Badge } from "@/components/ui/badge";

// Mapeo de colores para estados
const ESTADO_COLORS: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  aprobada: "bg-green-100 text-green-800",
  rechazada: "bg-red-100 text-red-800",
  en_proceso: "bg-blue-100 text-blue-800",
  finalizada: "bg-gray-100 text-gray-800",
};

export const List = () => (
  <Card>
    <CardHeader>
      <CardTitle>Solicitudes</CardTitle>
    </CardHeader>
    <CardContent>
      <RaList
        actions={<ListActions hasCreate />}
        perPage={25}
        sort={{ field: "created_at", order: "DESC" }}
        filters={[
          // Filtros por tipo, departamento, estado
        ]}
      >
        <Datagrid rowClick="edit" bulkActionButtons={false}>
          <TextField source="id" label="ID" />
          
          <ReferenceField
            source="tipo_solicitud_id"
            reference="tipos-solicitud"
            label="Tipo"
            link={false}
          >
            <TextField source="nombre" />
          </ReferenceField>
          
          <ReferenceField
            source="departamento_id"
            reference="departamentos"
            label="Departamento"
            link={false}
          >
            <TextField source="nombre" />
          </ReferenceField>
          
          <FunctionField
            label="Estado"
            render={(record: any) => (
              <Badge className={ESTADO_COLORS[record.estado] || ""}>
                {record.estado}
              </Badge>
            )}
          />
          
          <DateField source="fecha_necesidad" label="Fecha Necesidad" />
          
          <ReferenceField
            source="solicitante_id"
            reference="users"
            label="Solicitante"
            link={false}
          >
            <TextField source="nombre" />
          </ReferenceField>
          
          <TextField source="total" label="Total" />
        </Datagrid>
      </RaList>
    </CardContent>
  </Card>
);
```

---

## 4. REGISTRAR NUEVOS RECURSOS

**Ubicación:** `frontend/src/app/resources/index.ts`

```typescript
// frontend/src/app/resources/index.ts

import { ResourceProps } from "react-admin";

// Imports existentes...
import * as solicitudes from "./solicitudes";

// ✅ AGREGAR:
import * as departamentos from "./departamentos";
import * as tiposSolicitud from "./tipos-solicitud";

export const resources: ResourceProps[] = [
  // ... recursos existentes ...
  
  // ✅ NUEVOS RECURSOS
  {
    name: "departamentos",
    list: departamentos.List,
    create: departamentos.DepartamentoCreate,
    edit: departamentos.DepartamentoEdit,
    options: { label: "Departamentos" },
  },
  {
    name: "tipos-solicitud",
    list: tiposSolicitud.List,
    create: tiposSolicitud.TipoSolicitudCreate,
    edit: tiposSolicitud.TipoSolicitudEdit,
    options: { label: "Tipos de Solicitud" },
  },
  
  // Solicitudes (ya existe, solo actualizar imports)
  {
    name: "solicitudes",
    list: solicitudes.List,
    create: solicitudes.SolicitudCreate,
    edit: solicitudes.SolicitudEdit,
    options: { label: "Solicitudes" },
  },
];
```

---

## 5. FLUJO DE USUARIO (UX)

### 5.1 Crear Nueva Solicitud

1. Usuario hace clic en "Crear solicitud"
2. Formulario muestra:
   - Seleccionar **Tipo de solicitud** (obligatorio)
   - Al seleccionar tipo:
     - Auto-completa **Departamento** con el default del tipo (usuario puede cambiarlo)
     - Los artículos en detalles se filtran según `tipo_articulo_filter`
   - Usuario completa fecha, solicitante, comentarios
3. Usuario agrega artículos:
   - Solo ve artículos del tipo correcto (según filtro)
   - Si el tipo tiene `articulo_default_id`, podría pre-seleccionarse (opcional)
4. Estado por defecto: "Pendiente"
5. Total se calcula automáticamente (solo lectura)

### 5.2 Editar Solicitud Existente

1. Usuario puede cambiar tipo de solicitud
   - Al cambiar tipo, se sugiere nuevo departamento (no se fuerza)
   - Los artículos ya agregados NO se eliminan (solo se filtra al agregar nuevos)
2. Usuario puede cambiar estado (workflow):
   - Pendiente → Aprobada
   - Pendiente → Rechazada
   - Aprobada → En Proceso
   - En Proceso → Finalizada
3. Validaciones de transiciones de estado (opcional, puede ser frontend o backend)

### 5.3 Listar Solicitudes

- Vista de tabla con filtros por:
  - Tipo de solicitud
  - Departamento
  - Estado
  - Rango de fechas
- Columnas: ID, Tipo, Departamento, Estado (badge con color), Fecha, Solicitante, Total
- Click en fila abre edición

---

## 6. VALIDACIONES

### 6.1 Validaciones de Negocio

1. **Tipo de solicitud**: Obligatorio
2. **Departamento**: Obligatorio (puede ser default del tipo, pero usuario puede cambiar)
3. **Estado**: Default "pendiente", puede cambiarse
4. **Artículos**:
   - Mínimo 1 artículo
   - Si tipo tiene filtro, mostrar solo artículos compatibles
   - No validar si artículos existentes cumplen filtro (permitir edición flexible)
5. **Total**: Campo calculado, solo lectura (backend lo actualiza)

### 6.2 Validaciones de UI

1. ComboboxQuery de tipo de solicitud:
   - Solo mostrar tipos con `activo = true`
   - Ordenar alfabéticamente
2. ComboboxQuery de departamento:
   - Solo mostrar departamentos con `activo = true`
3. Al cambiar tipo:
   - Si departamento está vacío, sugerir el default
   - Si departamento ya tiene valor, no sobrescribir (respetar elección del usuario)
4. Filtro de artículos:
   - Aplicar solo al agregar nuevos detalles
   - No afectar artículos ya existentes en la solicitud

---

## 7. CASOS DE PRUEBA

### 7.1 Departamentos CRUD

- ✅ Crear departamento con nombre único
- ✅ No permitir nombres duplicados
- ✅ Editar descripción
- ✅ Desactivar departamento (activo = false)
- ✅ Listar departamentos ordenados por nombre
- ✅ Eliminar departamento (soft delete)

### 7.2 Tipos de Solicitud CRUD

- ✅ Crear tipo con nombre único
- ✅ Configurar filtro de artículos
- ✅ Asignar departamento default
- ✅ Asignar artículo default
- ✅ Editar configuración de tipo existente
- ✅ Desactivar tipo
- ✅ Listar tipos con relaciones expandidas

### 7.3 Solicitudes - Flujo Completo

- ✅ Crear solicitud seleccionando tipo
  - Verificar que departamento se sugiere automáticamente
  - Verificar que artículos se filtran correctamente
- ✅ Agregar 3 artículos de diferentes tipos
  - Si tipo filtra por "Material", solo mostrar artículos Material
- ✅ Cambiar tipo de solicitud en edición
  - Verificar que artículos existentes NO se eliminan
  - Verificar que nuevos artículos respetan nuevo filtro
- ✅ Cambiar departamento manualmente (sobrescribir default)
- ✅ Cambiar estado de Pendiente → Aprobada
- ✅ Listar solicitudes filtrando por tipo y estado
- ✅ Verificar que campo total es solo lectura

### 7.4 Migración de Datos

- ✅ Verificar que solicitudes antiguas (con tipo enum) se muestran correctamente
- ✅ Verificar que tienen tipo_solicitud_id y departamento_id asignados
- ✅ Verificar que se pueden editar sin errores

---

## 8. CHECKLIST DE IMPLEMENTACIÓN

### 8.1 Módulo Departamentos

- [ ] Crear `frontend/src/app/resources/departamentos/model.ts`
- [ ] Crear `frontend/src/app/resources/departamentos/List.tsx`
- [ ] Crear `frontend/src/app/resources/departamentos/form.tsx`
- [ ] Crear `frontend/src/app/resources/departamentos/create.tsx`
- [ ] Crear `frontend/src/app/resources/departamentos/edit.tsx`
- [ ] Crear `frontend/src/app/resources/departamentos/index.ts`
- [ ] Registrar en `resources/index.ts`
- [ ] Probar CRUD completo

### 8.2 Módulo Tipos de Solicitud

- [ ] Crear `frontend/src/app/resources/tipos-solicitud/model.ts`
- [ ] Crear `frontend/src/app/resources/tipos-solicitud/List.tsx`
- [ ] Crear `frontend/src/app/resources/tipos-solicitud/form.tsx`
- [ ] Crear `frontend/src/app/resources/tipos-solicitud/create.tsx`
- [ ] Crear `frontend/src/app/resources/tipos-solicitud/edit.tsx`
- [ ] Crear `frontend/src/app/resources/tipos-solicitud/index.ts`
- [ ] Registrar en `resources/index.ts`
- [ ] Probar CRUD completo con referencias

### 8.3 Modificar Solicitudes

- [ ] Actualizar `solicitudes/model.ts`:
  - [ ] Eliminar `TIPO_CHOICES`
  - [ ] Agregar `ESTADO_CHOICES`
  - [ ] Agregar `TIPOS_SOLICITUD_REFERENCE`
  - [ ] Agregar `DEPARTAMENTOS_REFERENCE`
  - [ ] Actualizar tipos `Solicitud` y `SolicitudFormValues`
  - [ ] Agregar helpers (getArticuloFilterByTipo, etc.)
- [ ] Actualizar `solicitudes/form.tsx`:
  - [ ] Reemplazar select "tipo" por ComboboxQuery "tipo_solicitud_id"
  - [ ] Agregar ComboboxQuery "departamento_id"
  - [ ] Agregar select "estado"
  - [ ] Implementar auto-asignación de departamento
  - [ ] Implementar filtrado de artículos
  - [ ] Actualizar subtitle con nuevos campos
- [ ] Actualizar `solicitudes/List.tsx`:
  - [ ] Agregar columnas tipo_solicitud, departamento, estado
  - [ ] Agregar badge con colores para estados
  - [ ] Agregar filtros
- [ ] Probar flujo completo de creación y edición

### 8.4 Testing

- [ ] Crear solicitud con tipo "Materiales"
  - [ ] Verificar que sugiere departamento "Compras"
  - [ ] Verificar que filtra artículos tipo "Material"
- [ ] Crear solicitud con tipo "Servicios"
  - [ ] Verificar que sugiere departamento correcto
  - [ ] Verificar que NO filtra artículos (sin filtro)
- [ ] Editar solicitud cambiando tipo
  - [ ] Verificar que artículos existentes se mantienen
  - [ ] Verificar que nuevos artículos respetan nuevo filtro
- [ ] Cambiar estado de solicitud
- [ ] Filtrar listado por tipo, departamento, estado
- [ ] Verificar solicitudes migradas (con datos antiguos)

### 8.5 Documentación

- [ ] Actualizar README con nuevos recursos
- [ ] Documentar flujo de defaults (tipo → departamento, artículos)
- [ ] Documentar validaciones de transiciones de estado (si aplica)

---

## 9. NOTAS IMPORTANTES

### 9.1 Compatibilidad con Datos Existentes

- Las solicitudes migradas tendrán `tipo_solicitud_id` y `departamento_id` asignados por backend
- El frontend debe manejar correctamente solicitudes con datos históricos
- No asumir que todas las solicitudes tienen configuraciones de filtro perfectas

### 9.2 Defaults vs Obligatorios

- **Departamento**: Es obligatorio, pero se **sugiere** según tipo (usuario puede cambiar)
- **Artículo default**: Es opcional, solo para mejorar UX (no implementar en primera versión si complejiza)
- **Filtro de artículos**: Se aplica al agregar nuevos detalles, NO afecta detalles existentes

### 9.3 Performance

- Usar `staleTime` apropiado en referencias:
  - Tipos de solicitud: 10 minutos (cambian poco)
  - Departamentos: 10 minutos (cambian poco)
  - Artículos: 5 minutos (cambian más frecuentemente)
- Cachear resultados de queries para evitar refetch innecesarios

### 9.4 Extensibilidad Futura

- Estados: Preparar para posibles validaciones de transiciones
- Filtros: Estructura permite agregar más filtros sin cambiar modelo
- Total: Campo calculado por backend, frontend solo muestra

---

## 10. REFERENCIAS

- **Backend Spec**: `20251107_bk_solicitudes_spec.md`
- **Patrones Frontend**: `frontend/src/app/resources/articulos/` (ejemplo CRUD simple)
- **Patrones Form**: `frontend/src/app/resources/solicitudes/form.tsx` (ejemplo con detalles)
- **Patrones Combobox**: Buscar `ComboboxQuery` en codebase existente

---

## 11. CRITERIOS DE ACEPTACIÓN

### 11.1 Funcionales

- ✅ Usuario puede crear y editar departamentos
- ✅ Usuario puede crear y editar tipos de solicitud
- ✅ Usuario puede crear solicitud seleccionando tipo
- ✅ Al seleccionar tipo, se sugiere departamento automáticamente
- ✅ Al agregar artículos, se filtran según tipo de solicitud
- ✅ Usuario puede cambiar departamento sugerido
- ✅ Usuario puede cambiar estado de solicitud
- ✅ Solicitudes migradas se visualizan correctamente
- ✅ Total se muestra como solo lectura

### 11.2 No Funcionales

- ✅ Tiempos de respuesta < 2 segundos en formularios
- ✅ Código sigue patrones establecidos en proyecto
- ✅ Componentes son reutilizables
- ✅ Validaciones son claras y descriptivas
- ✅ UX es consistente con resto de módulos

---

**Fin del documento de requerimientos frontend**
