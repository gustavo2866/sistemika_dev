"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormNumber,
  FormSelect,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import {
  ERP_INDICE_CODIGO_CHOICES,
  ERP_INDICE_DEFAULTS,
  erpIndiceSchema,
  type ErpIndiceFormValues,
} from "./model";

export const ErpIndiceForm = () => (
  <SimpleForm<ErpIndiceFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(erpIndiceSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_INDICE_DEFAULTS}
  >
    <SectionBaseTemplate
      title="Datos del índice"
      main={
        <div className="grid gap-2 md:grid-cols-3">
          <FormSelect
            source="codigo"
            label="Código"
            choices={ERP_INDICE_CODIGO_CHOICES}
            validate={required()}
            disableClear
            widthClass="w-full"
          />
          <FormDate
            source="fecha"
            label="Fecha"
            validate={required()}
            widthClass="w-full"
          />
          <FormNumber
            source="valor"
            label="Valor"
            validate={required()}
            step={0.000001}
            inputMode="decimal"
            widthClass="w-full"
          />
          <HiddenInput source="version" />
        </div>
      }
      defaultOpen
    />
  </SimpleForm>
);
