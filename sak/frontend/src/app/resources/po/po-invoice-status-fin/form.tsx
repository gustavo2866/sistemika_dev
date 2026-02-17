"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormNumber,
  FormBoolean,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  poInvoiceStatusFinSchema,
  PO_INVOICE_STATUS_FIN_DEFAULT,
  VALIDATION_RULES,
  type PoInvoiceStatusFinFormValues,
} from "./model";

const PoInvoiceStatusFinMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre"
        validate={required()}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.NOMBRE.MAX_LENGTH}
      />
      <FormNumber
        source="orden"
        label="Orden"
        validate={required()}
        widthClass="w-full"
        min={1}
      />
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
      <FormBoolean source="activo" label="Activo" defaultValue />
      <FormBoolean source="es_inicial" label="Es inicial" defaultValue={false} />
      <FormBoolean source="es_final" label="Es final" defaultValue={false} />
    </div>
  </div>
);

export const PoInvoiceStatusFinForm = () => (
  <SimpleForm<PoInvoiceStatusFinFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(poInvoiceStatusFinSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={PO_INVOICE_STATUS_FIN_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del estado financiero"
      main={<PoInvoiceStatusFinMainFields />}
      defaultOpen
    />
  </SimpleForm>
);
