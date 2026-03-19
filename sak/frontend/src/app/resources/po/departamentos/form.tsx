"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { ReferenceInput } from "@/components/reference-input";
import { SimpleForm } from "@/components/simple-form";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormSelect,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  CENTROS_COSTO_REFERENCE,
  DEPARTAMENTO_DEFAULT,
  VALIDATION_RULES,
  departamentoSchema,
  type DepartamentoFormValues,
} from "./model";

const DepartamentoMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre del departamento"
        validate={required()}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.NOMBRE.MAX_LENGTH}
      />
      <ReferenceInput
        source="centro_costo_id"
        reference={CENTROS_COSTO_REFERENCE.resource}
        filter={CENTROS_COSTO_REFERENCE.filter}
      >
        <FormSelect
          optionText={CENTROS_COSTO_REFERENCE.labelField}
          label="Centro de costo"
          widthClass="w-full"
          emptyText="Sin centro"
        />
      </ReferenceInput>
      <FormTextarea
        source="descripcion"
        label="Descripcion"
        rows={3}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.DESCRIPCION.MAX_LENGTH}
        className="md:col-span-2"
      />
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean
        source="activo"
        label="Departamento activo"
        defaultValue
      />
    </div>
  </div>
);

export const DepartamentoForm = () => (
  <SimpleForm<DepartamentoFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(departamentoSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={DEPARTAMENTO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos generales"
      main={<DepartamentoMainFields />}
      defaultOpen
    />
  </SimpleForm>
);
