"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { BooleanInput } from "@/components/boolean-input";
import { ReferenceInput } from "@/components/reference-input";
import {
  CompactFormField,
  CompactFormGrid,
  CompactFormSection,
  CompactSelectInput,
  CompactTextInput,
  FormLayout,
} from "@/components/forms";
import { CENTROS_COSTO_REFERENCE } from "./model";

export const DepartamentoForm = () => (
  <SimpleForm className="w-full max-w-4xl">
    <FormLayout
      sections={[
        {
          id: "datos-generales",
          title: "Datos generales",
          defaultOpen: true,
          contentPadding: "none",
          contentClassName: "space-y-3 px-4 py-3",
          children: (
            <CompactFormSection>
              <CompactFormGrid columns="two">
                <CompactTextInput
                  source="nombre"
                  label="Nombre del departamento"
                  validate={required()}
                  className="w-full"
                />
                <CompactFormField label="Centro de costo">
                  <ReferenceInput
                    source="centro_costo_id"
                    reference={CENTROS_COSTO_REFERENCE.resource}
                    label="Centro de costo"
                    filter={CENTROS_COSTO_REFERENCE.filter}
                  >
                    <CompactSelectInput
                      optionText={CENTROS_COSTO_REFERENCE.labelField}
                      emptyText="Sin centro"
                      className="w-full"
                      label={false}
                    />
                  </ReferenceInput>
                </CompactFormField>
              </CompactFormGrid>
              <CompactTextInput
                source="descripcion"
                label="Descripcion"
                multiline
                rows={3}
                className="w-full"
              />
              <BooleanInput
                source="activo"
                label="Departamento activo"
                defaultValue={true}
              />
            </CompactFormSection>
          ),
        },
      ]}
    />
  </SimpleForm>
);
