"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormNumber,
  FormReferenceAutocomplete,
  FormText,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import {
  ERP_CUENTA_DEFAULT,
  ERP_CUENTA_RULES,
  erpCuentaSchema,
  type ErpCuentaFormValues,
} from "./model";

const ErpCuentaMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormReferenceAutocomplete
        referenceProps={{
          source: "rubro_id",
          reference: "erp/rubros",
          filter: { activo: true },
        }}
        inputProps={{
          optionText: "nombre",
          label: "Rubro",
          validate: required(),
        }}
        widthClass="w-full"
      />
      <FormNumber
        source="nro_cuenta"
        label="Nro. cuenta"
        validate={required()}
        min={0}
        step={1}
        widthClass="w-full"
      />
      <FormText
        source="cod_cuenta"
        label="Codigo"
        validate={required()}
        widthClass="w-full"
        maxLength={ERP_CUENTA_RULES.COD_CUENTA.MAX_LENGTH}
      />
      <FormReferenceAutocomplete
        referenceProps={{
          source: "proyectos_concepto_id",
          reference: "constructora/proyectos-conceptos",
          filter: { activo: true },
        }}
        inputProps={{
          optionText: "nombre",
          label: "Concepto de proyecto",
          placeholder: "Selecciona un concepto (opcional)",
        }}
        widthClass="w-full"
      />
      <FormText
        source="descripcion"
        label="Descripcion"
        validate={required()}
        widthClass="w-full"
        maxLength={ERP_CUENTA_RULES.DESCRIPCION.MAX_LENGTH}
        className="md:col-span-2"
      />
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Activo" defaultValue />
    </div>
    <HiddenInput source="version" />
  </div>
);

export const ErpCuentaForm = () => (
  <SimpleForm<ErpCuentaFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(erpCuentaSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_CUENTA_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos de la cuenta"
      main={<ErpCuentaMainFields />}
      defaultOpen
    />
  </SimpleForm>
);
