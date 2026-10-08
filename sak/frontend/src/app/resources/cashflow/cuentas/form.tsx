"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import { FormSelect, FormText, HiddenInput, SectionBaseTemplate } from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import {
  ERP_CASH_CUENTA_DEFAULT,
  ERP_CASH_CUENTA_TIPO_CHOICES,
  erpCashCuentaSchema,
  type ErpCashCuentaFormValues,
} from "./model";

export const ErpCashCuentaForm = () => (
  <SimpleForm<ErpCashCuentaFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(erpCashCuentaSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_CASH_CUENTA_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos de la cuenta Cash"
      main={
        <>
          <FormText source="descripcion" label="Descripción" validate={required()} widthClass="w-full" maxLength={255} />
          <FormSelect
            source="tipo"
            label="Tipo"
            choices={ERP_CASH_CUENTA_TIPO_CHOICES}
            emptyText="Sin definir"
            widthClass="w-full"
          />
          <HiddenInput source="version" />
        </>
      }
      defaultOpen
    />
  </SimpleForm>
);
