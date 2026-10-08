"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormTextarea,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import {
  ERP_CASH_PROYECTADO_DEFAULT,
  ERP_CASH_PROYECTADO_TIPO_CHOICES,
  erpCashProyectadoSchema,
  type ErpCashProyectadoFormValues,
} from "./model";

export const ErpCashProyectadoForm = () => (
  <SimpleForm<ErpCashProyectadoFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(erpCashProyectadoSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_CASH_PROYECTADO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del valor proyectado"
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormReferenceAutocomplete
            referenceProps={{ source: "cuenta_cash_id", reference: "erp/cash/cuentas" }}
            inputProps={{ optionText: "descripcion", label: "Cuenta financiera", validate: required() }}
            widthClass="w-full"
          />
          <FormDate
            source="fecha_periodo"
            label="Período"
            validate={required()}
            helperText="Seleccionar el primer día del mes"
            widthClass="w-full"
          />
          <FormSelect
            source="tipo"
            label="Tipo"
            choices={ERP_CASH_PROYECTADO_TIPO_CHOICES}
            validate={required()}
            widthClass="w-full"
          />
          <FormNumber
            source="importe"
            label="Importe"
            validate={required()}
            step={0.01}
            widthClass="w-full"
          />
          <FormTextarea
            source="observacion"
            label="Observación"
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
