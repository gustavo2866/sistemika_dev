# model.template

Copia este contenido como `frontend/src/app/resources/<entidad>/model.ts`. Reemplaza `MyEntity` y constantes en mayúsculas con nombres del dominio real.

```ts
/**
 * Plantilla base del modelo de dominio para un recurso CRUD.
 *
 * Pasos para usarla:
 * 1. Copiar este archivo dentro de `frontend/src/app/resources/<entidad>/model.ts`.
 * 2. Reemplazar `MyEntity` y los identificadores en MAYUSCULAS por nombres del dominio real.
 * 3. Completar choices, referencias, tipos y schemas de validacion.
 *
 * Esta plantilla NO debe importar componentes de React. Solo utilidades de dominio.
 */

import type { UseFormReturn } from "react-hook-form";
import {
  createDetailSchema,
  createEntitySchema,
  numberField,
  referenceField,
  selectField,
  stringField,
} from "@/lib/form-detail-schema";

// ============================================
// 1. CONFIGURACION DEL DOMINIO
// ============================================

export const MY_ENTITY_STATUS_CHOICES = [
  { id: "draft", name: "Borrador" },
  { id: "pending", name: "Pendiente" },
  { id: "done", name: "Finalizado" },
];

export const RELATED_RESOURCE_REFERENCE = {
  resource: "related-resource",
  labelField: "nombre",
  limit: 50,
  staleTime: 5 * 60 * 1000,
} as const;

// ============================================
// 2. TIPOS
// ============================================

export type MyEntityDetail = {
  id?: number;
  descripcion: string;
  cantidad: number;
  precio: number;
  relacionado_id: number | null;
};

export type MyEntity = {
  id?: number;
  nombre: string;
  estado: string;
  responsable_id: number;
  comentario?: string;
  detalles: MyEntityDetail[];
};

export type MyEntityFormValues = {
  nombre: string;
  estado: string;
  responsable_id: string;
  comentario: string;
};

export type MyEntityDetailFormValues = {
  descripcion: string;
  cantidad: number;
  precio: number;
  relacionado_id: string;
};

// ============================================
// 3. VALORES DEFAULT
// ============================================

export const MY_ENTITY_DEFAULT_VALUES: MyEntityFormValues = {
  nombre: "",
  estado: MY_ENTITY_STATUS_CHOICES[0]?.id ?? "draft",
  responsable_id: "",
  comentario: "",
};

export const MY_ENTITY_DETAIL_DEFAULT_VALUES: MyEntityDetailFormValues = {
  descripcion: "",
  cantidad: 1,
  precio: 0,
  relacionado_id: "",
};

// ============================================
// 4. VALIDACIONES (SCHEMAS)
// ============================================

export const myEntitySchema = createEntitySchema({
  nombre: stringField({ required: true, maxLength: 120 }),
  estado: selectField({ choices: MY_ENTITY_STATUS_CHOICES }),
  responsable_id: referenceField({ resource: "users", labelField: "nombre" }),
  comentario: stringField({ maxLength: 500, nullable: true }),
});

export const myEntityDetailSchema = createDetailSchema({
  descripcion: stringField({ required: true, maxLength: 300 }),
  cantidad: numberField({ min: 1 }),
  precio: numberField({ min: 0 }),
  relacionado_id: referenceField(RELATED_RESOURCE_REFERENCE),
});

// ============================================
// 5. HELPERS (OPCIONALES)
// ============================================

export const useMyEntityDomainRules = (form: UseFormReturn<MyEntityFormValues>) => {
  const estado = form.watch("estado");

  // Ejemplo: si pasa a "done" forzar comentario obligatorio
  if (estado === "done") {
    form.setError("comentario", {
      type: "manual",
      message: "Ingresar un comentario antes de finalizar",
    });
  }
};
```
