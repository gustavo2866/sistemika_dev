"use client";

import { required } from "ra-core";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { Textarea } from "@/components/ui/textarea";
import {
  CompactFormField,
  CompactFormGrid,
  CompactFormSection,
  CompactTextInput,
  FormLayout,
} from "@/components/forms";
import { useFormContext } from "react-hook-form";

const CabeceraContent = () => (
  <CompactFormGrid columns="two">
    <CompactTextInput source="nombre" label="Nombre" className="w-full" validate={required()} />
    <CompactTextInput source="cuenta" label="Cuenta" className="w-full" validate={required()} />
  </CompactFormGrid>
);

const DetalleContent = () => {
  const form = useFormContext();
  return (
    <CompactFormField label="Descripcion">
      <Textarea
        rows={3}
        className="min-h-10 px-2 py-1 text-[11px] sm:min-h-16 sm:px-3 sm:py-2 sm:text-sm"
        {...form.register("descripcion")}
      />
    </CompactFormField>
  );
};

const FormFooter = () => <FormToolbar />;

export const AdmConceptoForm = () => (
  <SimpleForm className="w-full max-w-md" toolbar={<FormFooter />}>
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
