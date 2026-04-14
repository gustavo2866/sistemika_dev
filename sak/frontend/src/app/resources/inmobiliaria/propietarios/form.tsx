"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormSelect,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  CENTROS_COSTO_REFERENCE,
  CONCEPTOS_REFERENCE,
  PROPIETARIO_DEFAULT,
  PROPIETARIO_VALIDATIONS,
  TIPO_PERSONA_OPTIONS,
  propietarioSchema,
  type PropietarioFormValues,
} from "./model";

const PropietarioMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre"
        validate={required()}
        widthClass="w-full"
        maxLength={PROPIETARIO_VALIDATIONS.NOMBRE_MAX}
      />
      <ReferenceInput
        source="adm_concepto_id"
        reference={CONCEPTOS_REFERENCE.resource}
        label="Concepto administrativo"
        perPage={CONCEPTOS_REFERENCE.limit}
      >
        <FormSelect
          optionText={CONCEPTOS_REFERENCE.labelField}
          emptyText="Sin concepto"
          widthClass="w-full"
        />
      </ReferenceInput>
      <ReferenceInput
        source="centro_costo_id"
        reference={CENTROS_COSTO_REFERENCE.resource}
        label="Centro de costo"
        perPage={CENTROS_COSTO_REFERENCE.limit}
      >
        <FormSelect
          optionText={CENTROS_COSTO_REFERENCE.labelField}
          emptyText="Sin centro de costo"
          widthClass="w-full"
        />
      </ReferenceInput>
      <FormTextarea
        source="comentario"
        label="Comentario"
        rows={3}
        widthClass="w-full"
        maxLength={PROPIETARIO_VALIDATIONS.COMENTARIO_MAX}
        className="md:col-span-2"
      />
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Activo" defaultValue />
    </div>
  </div>
);

const PropietarioContactoFields = () => (
  <div className="grid gap-2 md:grid-cols-3">
    <FormText
      source="domicilio"
      label="Domicilio legal"
      widthClass="w-full md:col-span-3"
      maxLength={PROPIETARIO_VALIDATIONS.DOMICILIO_MAX}
    />
    <FormText
      source="localidad"
      label="Localidad"
      widthClass="w-full"
      maxLength={PROPIETARIO_VALIDATIONS.LOCALIDAD_MAX}
    />
    <FormText
      source="provincia"
      label="Provincia"
      widthClass="w-full"
      maxLength={PROPIETARIO_VALIDATIONS.PROVINCIA_MAX}
    />
    <FormSelect
      source="tipo_persona"
      label="Tipo persona"
      widthClass="w-full"
      choices={TIPO_PERSONA_OPTIONS as any}
      optionText="nombre"
      optionValue="id"
      emptyText="Sin asignar"
    />
    <FormText
      source="dni"
      label="DNI"
      widthClass="w-full"
      maxLength={PROPIETARIO_VALIDATIONS.DNI_MAX}
    />
    <FormText
      source="cuit"
      label="CUIT"
      widthClass="w-full"
      maxLength={PROPIETARIO_VALIDATIONS.CUIT_MAX}
    />
    <FormText
      source="email"
      label="Email"
      widthClass="w-full"
      maxLength={PROPIETARIO_VALIDATIONS.EMAIL_MAX}
    />
    <FormText
      source="telefono"
      label="Telefono"
      widthClass="w-full"
      maxLength={PROPIETARIO_VALIDATIONS.TELEFONO_MAX}
    />
  </div>
);

export const PropietarioForm = () => (
  <SimpleForm<PropietarioFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(propietarioSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={PROPIETARIO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del propietario"
      main={<PropietarioMainFields />}
      defaultOpen
    />
    <SectionBaseTemplate
      title="Datos de contacto"
      main={<PropietarioContactoFields />}
      defaultOpen={false}
    />
  </SimpleForm>
);
