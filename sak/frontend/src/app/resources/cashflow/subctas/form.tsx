"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import { FormNumber, FormText, HiddenInput, SectionBaseTemplate } from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import { ERP_CASH_SUBCTA_DEFAULT, erpCashSubctaSchema, type ErpCashSubctaFormValues } from "./model";

export const ErpCashSubctaForm = () => (
  <SimpleForm<ErpCashSubctaFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(erpCashSubctaSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_CASH_SUBCTA_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos de la subcuenta Cash"
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormNumber source="tpo_subcta" label="Tipo de subcuenta" validate={required()} min={0} step={1} widthClass="w-full" />
          <FormNumber source="nro_subcta" label="Número de subcuenta" validate={required()} min={0} step={1} widthClass="w-full" />
          <FormText source="descripcion" label="Descripción" validate={required()} widthClass="w-full" maxLength={255} />
          <FormText source="categoria" label="Categoría" validate={required()} widthClass="w-full" maxLength={50} />
          <HiddenInput source="version" />
        </div>
      }
      defaultOpen
    />
  </SimpleForm>
);
