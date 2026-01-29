"use client";

import { required, email as emailValidator } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import {
  CompactFormField,
  CompactFormGrid,
  CompactFormSection,
  CompactNumberInput,
  CompactSelectInput,
  CompactTextInput,
  FormLayout,
} from "@/components/forms";

export const UserForm = () => (
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
                  label="Nombre"
                  validate={required()}
                  className="w-full"
                />
                <CompactTextInput
                  source="email"
                  label="Email"
                  validate={[required(), emailValidator()]}
                  className="w-full"
                  type="email"
                />
              </CompactFormGrid>
              <CompactFormGrid columns="two">
                <CompactTextInput source="telefono" label="Telefono" className="w-full" />
                <CompactTextInput source="url_foto" label="URL Foto" className="w-full" />
              </CompactFormGrid>
              <CompactFormGrid columns="two">
                <CompactNumberInput source="pais_id" label="Pais (ID)" className="w-full" />
                <CompactFormField label="Departamento">
                  <ReferenceInput
                    source="departamento_id"
                    reference="departamentos"
                  >
                    <CompactSelectInput
                      optionText="nombre"
                      emptyText="Seleccionar departamento"
                      className="w-full"
                      label={false}
                    />
                  </ReferenceInput>
                </CompactFormField>
              </CompactFormGrid>
              <CompactFormGrid columns="two">
                <CompactFormField label="Centro de costo">
                  <ReferenceInput
                    source="centro_costo_id"
                    reference="centros-costo"
                  >
                    <CompactSelectInput
                      optionText="nombre"
                      emptyText="Seleccionar centro"
                      className="w-full"
                      label={false}
                    />
                  </ReferenceInput>
                </CompactFormField>
              </CompactFormGrid>
            </CompactFormSection>
          ),
        },
      ]}
    />
  </SimpleForm>
);
