"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { BooleanInput } from "@/components/boolean-input";
import { FormLayout, FormSimpleSection } from "@/components/forms";
import type { PoOrderStatusFormValues } from "./model";

const PoOrderStatusDatosSection = () => (
  <FormSimpleSection>
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput
        source="nombre"
        label="Nombre"
        className="w-full"
        validate={required()}
      />
      <NumberInput
        source="orden"
        label="Orden"
        className="w-full"
        validate={required()}
      />
      <TextInput
        source="descripcion"
        label="Descripcion"
        multiline
        rows={3}
        className="md:col-span-2"
      />
      <div className="flex flex-wrap gap-4 md:col-span-2">
        <BooleanInput source="activo" label="Activo" defaultValue />
        <BooleanInput source="es_inicial" label="Es inicial" defaultValue={false} />
        <BooleanInput source="es_final" label="Es final" defaultValue={false} />
      </div>
    </div>
  </FormSimpleSection>
);

export const PoOrderStatusForm = () => (
  <SimpleForm<PoOrderStatusFormValues> className="w-full max-w-4xl">
    <FormLayout
      sections={[
        {
          id: "datos-po-order-status",
          title: "Datos del estado",
          defaultOpen: true,
          children: <PoOrderStatusDatosSection />,
        },
      ]}
    />
  </SimpleForm>
);
