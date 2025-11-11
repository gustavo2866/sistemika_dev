"use client";

import { useMemo } from "react";
import { required } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FormLayout, FormSimpleSection, FormField, ComboboxQuery } from "@/components/forms";
import {
  ARTICULOS_REFERENCE,
  TIPO_SOLICITUD_TIPO_ARTICULO_CHOICES,
  type TipoSolicitudFormValues,
} from "./model";

const TipoSolicitudDatosSection = () => (
  <FormSimpleSection>
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput
        source="nombre"
        label="Nombre del tipo"
        className="w-full"
        validate={required()}
      />

      <SelectInput
        source="tipo_articulo_filter"
        label="Filtro de tipo artículo"
        choices={TIPO_SOLICITUD_TIPO_ARTICULO_CHOICES}
        className="w-full"
        emptyText="Sin filtro"
      />

      <TextInput
        source="descripcion"
        label="Descripción"
        multiline
        rows={3}
        className="md:col-span-2"
      />
    </div>
  </FormSimpleSection>
);

const TipoSolicitudConfiguracionSection = () => {
  const { control, formState } = useFormContext<TipoSolicitudFormValues>();
  const tipoArticuloFilterValue = useWatch({
    control,
    name: "tipo_articulo_filter",
  });
  const trimmedFilter = (tipoArticuloFilterValue ?? "").trim();
  const articuloFilter = useMemo(
    () => (trimmedFilter ? { tipo_articulo: trimmedFilter } : undefined),
    [trimmedFilter]
  );

  return (
    <FormSimpleSection>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Artículo sugerido por defecto"
          error={formState.errors.articulo_default_id}
        >
          <ComboboxQuery
            {...ARTICULOS_REFERENCE}
            source="articulo_default_id"
            placeholder="Selecciona un artículo (opcional)"
            filter={articuloFilter}
            dependsOn={trimmedFilter || undefined}
            className="w-full justify-between"
          />
        </FormField>

        <ReferenceInput
          source="departamento_default_id"
          reference="departamentos"
          label="Departamento sugerido por defecto"
        >
          <SelectInput optionText="nombre" className="w-full" emptyText="Ninguno (opcional)" />
        </ReferenceInput>

        <div className="md:col-span-2">
          <BooleanInput source="activo" label="Tipo activo" defaultValue={true} />
        </div>
      </div>
    </FormSimpleSection>
  );
};

export const TipoSolicitudForm = () => (
  <SimpleForm className="w-full max-w-4xl">
    <FormLayout
      sections={[
        {
          id: "datos-tipo-solicitud",
          title: "Datos del tipo de solicitud",
          defaultOpen: true,
          children: <TipoSolicitudDatosSection />,
        },
        {
          id: "configuracion-sugerida",
          title: "Sugerencias por defecto",
          defaultOpen: true,
          children: <TipoSolicitudConfiguracionSection />,
        },
      ]}
    />
  </SimpleForm>
);
