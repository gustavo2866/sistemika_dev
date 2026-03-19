"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  ARTICULOS_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  TIPO_SOLICITUD_DEFAULT,
  VALIDATION_RULES,
  tipoSolicitudSchema,
  type TipoSolicitudFormValues,
} from "./model";

const TipoSolicitudDatosSection = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre del tipo"
        validate={required()}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.NOMBRE.MAX_LENGTH}
      />
      <ReferenceInput
        source="tipo_articulo_filter_id"
        reference="tipos-articulo"
        filter={{ activo: true }}
        perPage={200}
      >
        <FormSelect
          optionText="nombre"
          label="Filtro de tipo articulo"
          widthClass="w-full"
          emptyText="Sin filtro"
        />
      </ReferenceInput>
      <FormTextarea
        source="descripcion"
        label="Descripcion"
        rows={3}
        widthClass="w-full"
        maxLength={VALIDATION_RULES.DESCRIPCION.MAX_LENGTH}
        className="md:col-span-2"
      />
    </div>
  </div>
);

const TipoSolicitudConfiguracionSection = () => {
  const { control, formState } = useFormContext<TipoSolicitudFormValues>();
  const tipoArticuloFilterValue = useWatch({
    control,
    name: "tipo_articulo_filter_id",
  });
  const tipoArticuloId = tipoArticuloFilterValue ? Number(tipoArticuloFilterValue) : undefined;
  const articuloFilter = useMemo(
    () => (tipoArticuloId ? { tipo_articulo_id: tipoArticuloId } : undefined),
    [tipoArticuloId]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 md:grid-cols-2">
        <FormReferenceAutocomplete
          referenceProps={{
            source: "articulo_default_id",
            reference: ARTICULOS_REFERENCE.resource,
            filter: articuloFilter,
          }}
          inputProps={{
            optionText: ARTICULOS_REFERENCE.labelField,
            label: "Articulo sugerido por defecto",
            placeholder: "Selecciona un articulo (opcional)",
          }}
          widthClass="w-full"
        />

        <ReferenceInput
          source="departamento_default_id"
          reference={DEPARTAMENTOS_REFERENCE.resource}
        >
          <FormSelect
            optionText={DEPARTAMENTOS_REFERENCE.labelField}
            label="Departamento sugerido por defecto"
            widthClass="w-full"
            emptyText="Ninguno (opcional)"
          />
        </ReferenceInput>

        <div className="md:col-span-2">
          <FormBoolean source="activo" label="Tipo activo" defaultValue />
        </div>
      </div>
    </div>
  );
};

export const TipoSolicitudForm = () => (
  <SimpleForm<TipoSolicitudFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(tipoSolicitudSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={TIPO_SOLICITUD_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del tipo de solicitud"
      main={<TipoSolicitudDatosSection />}
      defaultOpen
    />
    <SectionBaseTemplate
      title="Sugerencias por defecto"
      main={<TipoSolicitudConfiguracionSection />}
      defaultOpen
    />
  </SimpleForm>
);
