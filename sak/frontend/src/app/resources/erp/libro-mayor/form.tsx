"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormNumber,
  FormText,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import {
  ERP_LIBRO_MAYOR_DEFAULT,
  erpLibroMayorSchema,
  type ErpLibroMayorFormValues,
} from "./model";


export const ErpLibroMayorForm = () => (
  <SimpleForm<ErpLibroMayorFormValues>
    className="w-full max-w-5xl"
    resolver={zodResolver(erpLibroMayorSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_LIBRO_MAYOR_DEFAULT}
  >
    <SectionBaseTemplate
      title="Origen y período"
      main={
        <div className="grid gap-2 md:grid-cols-3">
          <FormNumber source="source_id" label="ID de origen" validate={required()} min={1} step={1} widthClass="w-full" />
          <FormNumber source="empresa_id" label="Empresa" validate={required()} min={1} step={1} widthClass="w-full" />
          <FormDate source="fecha_periodo" label="Fecha del período" widthClass="w-full" />
          <FormNumber source="periodo_anio" label="Año" validate={required()} min={2000} max={2200} step={1} widthClass="w-full" />
          <FormNumber source="periodo_mes" label="Mes" validate={required()} min={1} max={12} step={1} widthClass="w-full" />
          <FormText source="nivel" label="Nivel" validate={required()} maxLength={10} widthClass="w-full" />
          <HiddenInput source="version" />
        </div>
      }
      defaultOpen
    />
    <SectionBaseTemplate
      title="Imputación contable"
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormNumber source="cuenta_codigo" label="Cuenta contable" validate={required()} min={0} step={1} widthClass="w-full" />
          <FormText source="centro_costo" label="Centro de costo" maxLength={20} widthClass="w-full" />
          <FormText source="tipo_subcuenta" label="Tipo de subcuenta" maxLength={50} widthClass="w-full" />
          <FormText source="nro_subcuenta" label="Número de subcuenta" maxLength={50} widthClass="w-full" />
        </div>
      }
      defaultOpen
    />
    <SectionBaseTemplate
      title="Saldos"
      main={
        <div className="grid gap-2 md:grid-cols-3">
          <FormNumber source="total_debe" label="Total debe" validate={required()} step={0.01} widthClass="w-full" />
          <FormNumber source="total_haber" label="Total haber" validate={required()} step={0.01} widthClass="w-full" />
          <FormNumber source="total_debe_actualizado" label="Total debe actualizado" step={0.000001} widthClass="w-full" />
          <FormNumber source="total_haber_actualizado" label="Total haber actualizado" step={0.000001} widthClass="w-full" />
          <FormNumber source="saldo_anterior" label="Saldo anterior" validate={required()} step={0.01} widthClass="w-full" />
          <FormNumber source="saldo_periodo" label="Saldo del período" validate={required()} step={0.01} widthClass="w-full" />
          <FormNumber source="saldo_acumulado" label="Saldo acumulado" validate={required()} step={0.01} widthClass="w-full" />
        </div>
      }
      defaultOpen
    />
  </SimpleForm>
);
