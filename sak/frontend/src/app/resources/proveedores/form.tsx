"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required, email as emailValidator, useGetOne } from "ra-core";
import { useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  ARTICULOS_REFERENCE,
  CONCEPTOS_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  METODOS_PAGO_REFERENCE,
  TIPOS_COMPROBANTE_REFERENCE,
  PROVEEDOR_DEFAULT,
  PROVEEDOR_VALIDATIONS,
  TIPOS_SOLICITUD_REFERENCE,
  USERS_REFERENCE,
  proveedorSchema,
  type ProveedorFormValues,
} from "./model";

const DefaultArticuloField = () => {
  const tipoSolicitudValue = useWatch({ name: "default_tipo_solicitud_id" });
  const tipoSolicitudId = Number(tipoSolicitudValue);
  const tipoSolicitudIdValid = Number.isFinite(tipoSolicitudId) && tipoSolicitudId > 0;
  const { data: tipoSolicitud } = useGetOne(
    "tipos-solicitud",
    { id: tipoSolicitudIdValid ? tipoSolicitudId : 0 },
    { enabled: tipoSolicitudIdValid },
  );
  const tipoArticuloFilterId = (
    tipoSolicitud as { tipo_articulo_filter_id?: number } | undefined
  )?.tipo_articulo_filter_id;
  const articuloFilter =
    typeof tipoArticuloFilterId === "number"
      ? { tipo_articulo_id: tipoArticuloFilterId }
      : undefined;

  return (
    <FormReferenceAutocomplete
      referenceProps={{
        source: "default_articulos_id",
        reference: ARTICULOS_REFERENCE.resource,
        filter: articuloFilter,
      }}
      inputProps={{
        optionText: ARTICULOS_REFERENCE.labelField,
        label: "Articulo default",
      }}
      widthClass="w-full"
    />
  );
};

const ProveedorMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre"
        validate={required()}
        widthClass="w-full"
        maxLength={PROVEEDOR_VALIDATIONS.NOMBRE_MAX}
      />
      <FormText
        source="razon_social"
        label="Razon social"
        validate={required()}
        widthClass="w-full"
        maxLength={PROVEEDOR_VALIDATIONS.RAZON_SOCIAL_MAX}
      />
      <FormText
        source="cuit"
        label="CUIT"
        validate={required()}
        widthClass="w-full"
        maxLength={PROVEEDOR_VALIDATIONS.CUIT_MAX}
      />
      <FormText
        source="telefono"
        label="Telefono"
        widthClass="w-full"
        maxLength={PROVEEDOR_VALIDATIONS.TELEFONO_MAX}
      />
      <FormText
        source="email"
        label="Email"
        type="email"
        validate={emailValidator()}
        widthClass="w-full"
        maxLength={PROVEEDOR_VALIDATIONS.EMAIL_MAX}
      />
      <FormText
        source="direccion"
        label="Direccion"
        widthClass="w-full"
        maxLength={PROVEEDOR_VALIDATIONS.DIRECCION_MAX}
      />
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Activo" />
    </div>
  </div>
);

const ProveedorBancarioFields = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormText
      source="cbu"
      label="CBU"
      widthClass="w-full"
      maxLength={PROVEEDOR_VALIDATIONS.CBU_MAX}
    />
    <FormText
      source="alias_bancario"
      label="Alias bancario"
      widthClass="w-full"
      maxLength={PROVEEDOR_VALIDATIONS.ALIAS_BANCARIO_MAX}
    />
  </div>
);

const ProveedorDefaultsFields = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <ReferenceInput
      source="tipo_comprobante_id"
      reference={TIPOS_COMPROBANTE_REFERENCE.resource}
      label="Tipo de comprobante"
      perPage={TIPOS_COMPROBANTE_REFERENCE.limit}
    >
      <FormSelect optionText="name" emptyText="Sin default" widthClass="w-full" />
    </ReferenceInput>
    <FormNumber
      source="dias_vencimiento"
      label="Dias de vencimiento"
      widthClass="w-full"
      min={0}
    />
    <ReferenceInput
      source="default_tipo_solicitud_id"
      reference={TIPOS_SOLICITUD_REFERENCE.resource}
      label="Tipo de solicitud"
      perPage={TIPOS_SOLICITUD_REFERENCE.limit}
    >
      <FormSelect optionText="nombre" emptyText="Sin default" widthClass="w-full" />
    </ReferenceInput>
    <ReferenceInput
      source="default_departamento_id"
      reference={DEPARTAMENTOS_REFERENCE.resource}
      label="Departamento"
      perPage={DEPARTAMENTOS_REFERENCE.limit}
    >
      <FormSelect optionText="nombre" emptyText="Sin default" widthClass="w-full" />
    </ReferenceInput>
    <ReferenceInput
      source="concepto_id"
      reference={CONCEPTOS_REFERENCE.resource}
      label="Concepto (opcional)"
      perPage={CONCEPTOS_REFERENCE.limit}
    >
      <FormSelect optionText="nombre" emptyText="Sin concepto" widthClass="w-full" />
    </ReferenceInput>
    <DefaultArticuloField />
    <ReferenceInput
      source="default_metodo_pago_id"
      reference={METODOS_PAGO_REFERENCE.resource}
      label="Metodo de pago"
      perPage={METODOS_PAGO_REFERENCE.limit}
    >
      <FormSelect optionText="nombre" emptyText="Sin default" widthClass="w-full" />
    </ReferenceInput>
    <ReferenceInput
      source="default_usuario_responsable_id"
      reference={USERS_REFERENCE.resource}
      label="Usuario responsable"
    >
      <FormSelect optionText="nombre" emptyText="Sin default" widthClass="w-full" />
    </ReferenceInput>
  </div>
);

export const ProveedorForm = () => (
  <SimpleForm<ProveedorFormValues>
    className="w-full max-w-3xl"
    resolver={zodResolver(proveedorSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={PROVEEDOR_DEFAULT}
  >
    <SectionBaseTemplate title="Datos generales" main={<ProveedorMainFields />} defaultOpen />
    <SectionBaseTemplate title="Datos bancarios" main={<ProveedorBancarioFields />} defaultOpen={false} />
    <SectionBaseTemplate title="Defaults de compra" main={<ProveedorDefaultsFields />} defaultOpen={false} />
  </SimpleForm>
);
