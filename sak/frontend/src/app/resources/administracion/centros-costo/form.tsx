"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { BooleanInput } from "@/components/boolean-input";
import {
  CompactFormGrid,
  CompactFormSection,
  CompactSelectInput,
  CompactTextInput,
  FormLayout,
} from "@/components/forms";
import { CENTRO_COSTO_TIPO_CHOICES } from "./model";

const CentroCostoFormFields = () => (
  <FormLayout
    sections={[
      {
        id: "datos-centro-costo",
        title: "Datos del centro de costo",
        defaultOpen: true,
        contentPadding: "none",
        contentClassName: "space-y-3 px-4 py-3",
        children: (
          <CompactFormSection>
            <CompactFormGrid columns="two">
              <CompactTextInput
                source="nombre"
                label="Nombre"
                className="w-full"
                validate={required()}
              />
              <CompactSelectInput
                source="tipo"
                label="Tipo"
                className="w-full"
                choices={CENTRO_COSTO_TIPO_CHOICES}
                validate={required()}
              />
            </CompactFormGrid>
            <CompactFormGrid columns="two">
              <CompactTextInput
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
            </CompactFormGrid>
            <CompactTextInput
              source="descripcion"
              label="Descripción"
              multiline
              rows={3}
              className="w-full"
            />
          </CompactFormSection>
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
