"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormSelect,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import {
  ERP_CASH_PERIODO_DEFAULT,
  ERP_CASH_PERIODO_ESTADO_CHOICES,
  erpCashPeriodoSchema,
  type ErpCashPeriodoFormValues,
} from "./model";

export const ErpCashPeriodoForm = () => (
  <SimpleForm<ErpCashPeriodoFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(erpCashPeriodoSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_CASH_PERIODO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Control del período"
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormDate
            source="fecha_periodo"
            label="Período"
            validate={required()}
            helperText="Seleccionar el primer día del mes"
            widthClass="w-full"
          />
          <FormSelect
            source="estado"
            label="Estado"
            choices={ERP_CASH_PERIODO_ESTADO_CHOICES}
            validate={required()}
            widthClass="w-full"
          />
          <HiddenInput source="version" />
        </div>
      }
      defaultOpen
    />
  </SimpleForm>
);
