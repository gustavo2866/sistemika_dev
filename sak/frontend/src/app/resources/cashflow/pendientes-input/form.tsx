"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
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
  ERP_CASH_PENDIENTES_INPUT_DEFAULT,
  ERP_CASH_PENDIENTES_INPUT_IMPORT_STATUS_CHOICES,
  ERP_CASH_PENDIENTES_INPUT_VALIDATION_STATUS_CHOICES,
  erpCashPendientesInputSchema,
  type ErpCashPendientesInputFormValues,
} from "./model";

export const ErpCashPendientesInputForm = () => (
  <SimpleForm<ErpCashPendientesInputFormValues>
    className="w-full max-w-5xl"
    resolver={zodResolver(erpCashPendientesInputSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_CASH_PENDIENTES_INPUT_DEFAULT}
  >
    <SectionBaseTemplate
      title="Origen y procesamiento"
      main={
        <div className="grid gap-2 md:grid-cols-3">
          <FormReferenceAutocomplete
            referenceProps={{ source: "erp_empresa_id", reference: "erp/empresas" }}
            inputProps={{
              optionText: "empresa_nombre",
              label: "Empresa ERP",
              validate: required(),
            }}
            widthClass="w-full"
          />
          <FormText
            source="source_name"
            label="Origen"
            validate={required()}
            maxLength={100}
            widthClass="w-full"
          />
          <FormNumber
            source="uploaded_by"
            label="Usuario de carga"
            min={1}
            step={1}
            widthClass="w-full"
          />
          <FormText
            source="file_name"
            label="Archivo"
            validate={required()}
            maxLength={255}
            widthClass="w-full md:col-span-2"
          />
          <FormNumber
            source="row_number"
            label="Fila"
            validate={required()}
            min={1}
            step={1}
            widthClass="w-full"
          />
          <FormText
            source="file_hash"
            label="Hash del archivo"
            maxLength={128}
            widthClass="w-full md:col-span-3"
          />
          <FormSelect
            source="import_status"
            label="Estado de importación"
            choices={ERP_CASH_PENDIENTES_INPUT_IMPORT_STATUS_CHOICES}
            validate={required()}
            widthClass="w-full"
          />
          <FormSelect
            source="validation_status"
            label="Estado de validación"
            choices={ERP_CASH_PENDIENTES_INPUT_VALIDATION_STATUS_CHOICES}
            validate={required()}
            widthClass="w-full"
          />
          <div className="flex items-end pb-1">
            <FormBoolean source="is_valid" label="Fila válida" />
          </div>
          <HiddenInput source="version" />
        </div>
      }
      defaultOpen
    />

    <SectionBaseTemplate
      title="Datos originales del pendiente"
      main={
        <div className="grid gap-2 md:grid-cols-3">
          <FormText source="tipcomp_raw" label="Tipo comprobante" maxLength={50} widthClass="w-full" />
          <FormText source="sucursal_raw" label="Sucursal" maxLength={50} widthClass="w-full" />
          <FormText source="nrocomp_raw" label="N.º comprobante" maxLength={50} widthClass="w-full" />
          <FormText source="nombre_raw" label="Nombre" maxLength={255} widthClass="w-full md:col-span-2" />
          <FormText source="nrocta_raw" label="N.º cuenta" maxLength={50} widthClass="w-full" />
          <FormText source="tipsub_raw" label="Tipo subcuenta" maxLength={50} widthClass="w-full" />
          <FormText source="nrosub_raw" label="N.º subcuenta" maxLength={50} widthClass="w-full" />
          <FormText source="subs_descrip_raw" label="Descripción subcuenta" maxLength={255} widthClass="w-full" />
          <FormText source="fecvenc_raw" label="Fecha de vencimiento" maxLength={30} widthClass="w-full" />
          <FormText source="fecpre_raw" label="Fecha de presentación" maxLength={30} widthClass="w-full" />
          <FormText source="saldo_raw" label="Saldo" maxLength={100} widthClass="w-full" />
          <FormText source="imp_ext_raw" label="Importe externo" maxLength={100} widthClass="w-full" />
          <FormTextarea
            source="descrip_raw"
            label="Descripción"
            maxLength={1000}
            rows={3}
            widthClass="w-full md:col-span-3"
          />
        </div>
      }
      defaultOpen
    />

    <SectionBaseTemplate
      title="Validación y registro crudo"
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormTextarea
            source="validation_errors"
            label="Errores de validación"
            rows={5}
            widthClass="w-full"
          />
          <FormTextarea
            source="raw_row"
            label="Fila original"
            rows={5}
            widthClass="w-full"
          />
        </div>
      }
      defaultOpen={false}
    />
  </SimpleForm>
);
