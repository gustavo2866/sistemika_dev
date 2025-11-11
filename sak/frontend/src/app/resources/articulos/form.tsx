"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FormLayout, FormSimpleSection } from "@/components/forms";
import { TIPO_ARTICULO_CHOICES } from "./model";

const ArticuloDatosGeneralesSection = () => (
  <FormSimpleSection>
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="nombre" label="Nombre" validate={required()} className="w-full" />
      <SelectInput
        source="tipo_articulo"
        label="Tipo de artículo"
        choices={TIPO_ARTICULO_CHOICES}
        className="w-full"
        validate={required()}
      />
      <TextInput source="unidad_medida" label="Unidad de medida" validate={required()} className="w-full" />
      <TextInput source="marca" label="Marca" className="w-full" />
    </div>
  </FormSimpleSection>
);

const ArticuloComercialSection = () => (
  <FormSimpleSection>
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="sku" label="SKU" className="w-full" />
      <NumberInput source="precio" label="Precio" step={0.01} validate={required()} className="w-full" />
      <div className="md:col-span-2">
        <ReferenceInput source="proveedor_id" reference="proveedores" label="Proveedor (opcional)">
          <SelectInput optionText="nombre" emptyText="Sin proveedor" className="w-full" />
        </ReferenceInput>
      </div>
    </div>
  </FormSimpleSection>
);

export const ArticuloForm = () => (
  <SimpleForm className="w-full max-w-4xl">
    <FormLayout
      sections={[
        {
          id: "datos-generales",
          title: "Datos del artículo",
          defaultOpen: true,
          children: <ArticuloDatosGeneralesSection />,
        },
        {
          id: "informacion-comercial",
          title: "Información comercial",
          defaultOpen: true,
          children: <ArticuloComercialSection />,
        },
      ]}
    />
  </SimpleForm>
);
