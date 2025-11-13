"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { BooleanInput } from "@/components/boolean-input";
import { FormLayout, FormSimpleSection } from "@/components/forms";
import { CENTRO_COSTO_TIPO_CHOICES } from "./model";

const CentroCostoFormFields = () => (
  <FormLayout
    sections={[
      {
        id: "datos-centro-costo",
        title: "Datos del centro de costo",
        defaultOpen: true,
        children: (
          <FormSimpleSection>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                source="nombre"
                label="Nombre"
                className="w-full"
                validate={required()}
              />

              <SelectInput
                source="tipo"
                label="Tipo"
                className="w-full"
                choices={CENTRO_COSTO_TIPO_CHOICES}
                validate={required()}
              />

              <TextInput
                source="codigo_contable"
                label="Código contable"
                className="w-full"
                validate={required()}
                helperText="Ej: GEN-0001, PROY-0005"
              />

              <BooleanInput
                source="activo"
                label="Activo"
                defaultValue={true}
                className="w-full"
              />

              <TextInput
                source="descripcion"
                label="Descripción"
                multiline
                rows={3}
                className="md:col-span-2"
              />
            </div>
          </FormSimpleSection>
        ),
      },
    ]}
  />
);

export const CentroCostoForm = () => (
  <SimpleForm className="w-full max-w-3xl">
    <CentroCostoFormFields />
  </SimpleForm>
);
