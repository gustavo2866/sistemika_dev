"use client";

import { SimpleForm } from "@/components/forms/form_order/simple_form";
import { ReferenceInput } from "@/components/reference-input";
import {
  CompactFormGrid,
  CompactFormSection,
  CompactSelectInput,
  CompactTextInput,
  FormLayout,
} from "@/components/forms";
import { required } from "ra-core";
import { CRM_CONTACTO_DEFAULTS } from "./model";

export const CRMContactoForm = () => {
  return (
    <SimpleForm className="w-full max-w-4xl" defaultValues={CRM_CONTACTO_DEFAULTS}>
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
              <CompactTextInput
                source="nombre_completo"
                label="Nombre completo"
                validate={required()}
                className="w-full"
              />
              <CompactFormGrid columns="two">
                <CompactTextInput
                  source="email"
                  label="Email"
                  type="email"
                  className="w-full"
                />
                <CompactTextInput
                  source="red_social"
                  label="Usuario / red social"
                  className="w-full"
                />
              </CompactFormGrid>
              <ReferenceInput source="responsable_id" reference="users" label="Responsable">
                <CompactSelectInput optionText="nombre" className="w-full" validate={required()} />
              </ReferenceInput>
              <CompactTextInput
                source="telefonos.0"
                label="Teléfono principal"
                className="w-full"
              />
              <CompactTextInput source="notas" label="Notas" multiline className="w-full" />
            </CompactFormSection>
          ),
        },
      ]}
    />
  </SimpleForm>
  );
};
