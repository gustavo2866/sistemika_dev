"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormNumber,
  FormText,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import {
  ERP_EMPRESA_DEFAULT,
  erpEmpresaSchema,
  type ErpEmpresaFormValues,
} from "./model";

export const ErpEmpresaForm = () => (
  <SimpleForm<ErpEmpresaFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(erpEmpresaSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_EMPRESA_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos de la empresa ERP"
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormNumber
            source="empresa_id"
            label="ID de empresa ERP"
            validate={required()}
            min={1}
            step={1}
            widthClass="w-full"
          />
          <FormText
            source="grupo"
            label="Grupo"
            validate={required()}
            maxLength={50}
            widthClass="w-full"
          />
          <FormText
            source="empresa_nombre"
            label="Nombre"
            validate={required()}
            maxLength={255}
            widthClass="w-full md:col-span-2"
          />
          <HiddenInput source="version" />
        </div>
      }
      defaultOpen
    />
  </SimpleForm>
);
