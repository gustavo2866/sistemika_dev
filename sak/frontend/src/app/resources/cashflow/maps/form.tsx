"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import { FormNumber, FormReferenceAutocomplete, FormText, HiddenInput, SectionBaseTemplate } from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import { ERP_CASH_MAP_DEFAULT, erpCashMapSchema, type ErpCashMapFormValues } from "./model";

export const ErpCashMapForm = () => (
  <SimpleForm<ErpCashMapFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(erpCashMapSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_CASH_MAP_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del mapeo Cash"
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormNumber source="nro_cta" label="Número de cuenta ERP" validate={required()} min={0} step={1} widthClass="w-full" />
          <FormText source="moneda" label="Moneda" validate={required()} widthClass="w-full" maxLength={10} />
          <FormText source="categoria" label="Categoría" widthClass="w-full" maxLength={50} />
          <div />
          <FormReferenceAutocomplete
            referenceProps={{ source: "map_debe_id", reference: "erp/cash/cuentas" }}
            inputProps={{ optionText: "descripcion", label: "Mapeo Debe", validate: required() }}
            widthClass="w-full"
          />
          <FormReferenceAutocomplete
            referenceProps={{ source: "map_haber_id", reference: "erp/cash/cuentas" }}
            inputProps={{ optionText: "descripcion", label: "Mapeo Haber", validate: required() }}
            widthClass="w-full"
          />
          <HiddenInput source="version" />
        </div>
      }
      defaultOpen
    />
  </SimpleForm>
);
