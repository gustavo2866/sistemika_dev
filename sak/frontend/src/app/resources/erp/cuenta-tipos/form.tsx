"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormText,
  FormTextarea,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import {
  ERP_CUENTA_TIPO_DEFAULT,
  erpCuentaTipoSchema,
  type ErpCuentaTipoFormValues,
} from "./model";


export const ErpCuentaTipoForm = () => (
  <SimpleForm<ErpCuentaTipoFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(erpCuentaTipoSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_CUENTA_TIPO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del tipo de cuenta"
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormText source="nombre" label="Nombre" validate={required()} maxLength={200} widthClass="w-full" />
          <FormText source="cuenta" label="Cuenta" validate={required()} maxLength={50} widthClass="w-full" />
          <FormTextarea source="descripcion" label="Descripción" maxLength={500} rows={3} widthClass="w-full md:col-span-2" />
          <FormBoolean source="es_impuesto" label="Es impuesto" />
          <HiddenInput source="version" />
        </div>
      }
      defaultOpen
    />
  </SimpleForm>
);
