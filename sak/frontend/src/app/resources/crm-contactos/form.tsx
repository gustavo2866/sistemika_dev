"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import {
  CompactFormGrid,
  CompactFormSection,
  CompactSelectInput,
  CompactTextInput,
  FormLayout,
} from "@/components/forms";
import { required } from "ra-core";

export const CRMContactoForm = () => (
  <SimpleForm
    className="w-full max-w-4xl"
    transform={(data) => {
      const rawTelefonos = (data as { telefonos?: unknown }).telefonos;
      let telefonoPrincipal: string | undefined;

      if (Array.isArray(rawTelefonos)) {
        telefonoPrincipal = rawTelefonos[0] as string | undefined;
      } else if (rawTelefonos && typeof rawTelefonos === "object") {
        const indexed = rawTelefonos as Record<string, unknown>;
        telefonoPrincipal = indexed["0"] as string | undefined;
      } else if (typeof rawTelefonos === "string") {
        telefonoPrincipal = rawTelefonos;
      }

      return {
        ...data,
        telefonos: telefonoPrincipal ? [telefonoPrincipal] : [],
      };
    }}
  >
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
