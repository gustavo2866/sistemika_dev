"use client";

import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { Textarea } from "@/components/ui/textarea";
import { required } from "ra-core";
import {
  CompactFormGrid,
  CompactFormSection,
  CompactSelectInput,
  CompactTextInput,
  CompactFormField,
  FormLayout,
} from "@/components/forms";

const CabeceraContent = () => (
  <CompactFormGrid columns="two">
    <CompactTextInput source="nombre" label="Nombre" className="w-full" validate={required()} />
    <ReferenceInput source="categoria_id" reference="categorias" label="Categoria">
      <CompactSelectInput optionText="nombre" className="w-full" validate={required()} />
    </ReferenceInput>
  </CompactFormGrid>
);

const DetalleContent = () => (
  <CompactFormField label="Observaciones">
    <Textarea
      rows={3}
      className="min-h-10 px-2 py-1 text-[11px] sm:min-h-16 sm:px-3 sm:py-2 sm:text-sm"
    />
  </CompactFormField>
);

const FormFooter = () => <FormToolbar />;

export const RecursoFormExample = () => (
  <SimpleForm toolbar={<FormFooter />}>
    <FormLayout
      sections={[
        {
          id: "cabecera",
          title: "Cabecera",
          defaultOpen: true,
          contentPadding: "none",
          contentClassName: "space-y-2 px-4 py-2",
          children: (
            <CompactFormSection>
              <CabeceraContent />
            </CompactFormSection>
          ),
        },
        {
          id: "detalle",
          title: "Detalle",
          defaultOpen: false,
          children: (
            <CompactFormSection>
              <DetalleContent />
            </CompactFormSection>
          ),
        },
      ]}
    />
  </SimpleForm>
);
