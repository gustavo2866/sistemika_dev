"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormTextarea,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import {
  CASH_CHOICES,
  ERP_CASH_DIARIO_DEFAULT,
  erpCashDiarioSchema,
  type ErpCashDiarioFormValues,
} from "./model";

export const ErpCashDiarioForm = () => (
  <SimpleForm<ErpCashDiarioFormValues>
    className="w-full max-w-5xl"
    resolver={zodResolver(erpCashDiarioSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_CASH_DIARIO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Asiento y período"
      main={
        <div className="grid gap-2 md:grid-cols-3">
          <FormNumber source="source_id" label="ID de origen" validate={required()} min={1} step={1} widthClass="w-full" />
          <FormNumber source="empresa_id" label="Empresa" validate={required()} min={1} step={1} widthClass="w-full" />
          <FormDate source="fecha" label="Fecha" validate={required()} widthClass="w-full" />
          <FormNumber source="periodo_anio" label="Año" validate={required()} min={2000} max={2200} step={1} widthClass="w-full" />
          <FormNumber source="periodo_mes" label="Mes" validate={required()} min={1} max={12} step={1} widthClass="w-full" />
          <FormText source="tipo_asiento" label="Tipo de asiento" widthClass="w-full" maxLength={255} />
          <FormText source="nro_asiento" label="Número de asiento" widthClass="w-full" maxLength={255} />
          <FormText source="nro_renglon" label="Renglón" widthClass="w-full" maxLength={255} />
          <HiddenInput source="version" />
        </div>
      }
      defaultOpen
    />
    <SectionBaseTemplate
      title="Movimiento contable"
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormNumber source="cuenta_codigo" label="Cuenta contable" validate={required()} min={0} step={1} widthClass="w-full" />
          <FormText source="rubro" label="Rubro" widthClass="w-full" maxLength={255} />
          <FormNumber source="debe" label="Debe" validate={required()} step={0.01} widthClass="w-full" />
          <FormNumber source="haber" label="Haber" validate={required()} step={0.01} widthClass="w-full" />
          <FormText source="tipo_subcuenta" label="Tipo de subcuenta" widthClass="w-full" maxLength={255} />
          <FormText source="nro_subcuenta" label="Número de subcuenta" widthClass="w-full" maxLength={255} />
          <FormText source="centro_costo" label="Centro de costo" widthClass="w-full" maxLength={255} />
          <FormText source="archivo_origen" label="Archivo de origen" widthClass="w-full" maxLength={255} />
          <FormTextarea source="descripcion" label="Descripción" rows={3} widthClass="w-full" className="md:col-span-2" />
        </div>
      }
      defaultOpen
    />
    <SectionBaseTemplate
      title="Clasificación Cash"
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormSelect source="cash" label="Cash" choices={CASH_CHOICES} emptyText="Sin definir" widthClass="w-full" />
          <FormReferenceAutocomplete
            referenceProps={{ source: "cuenta_cash_id", reference: "erp/cash/cuentas" }}
            inputProps={{ optionText: "descripcion", label: "Cuenta Cash", placeholder: "Seleccionar cuenta" }}
            widthClass="w-full"
          />
        </div>
      }
      defaultOpen
    />
  </SimpleForm>
);
