"use client";

import { required } from "ra-core";
import { useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { NumberInput } from "@/components/number-input";
import { ReferenceInput } from "@/components/reference-input";
import {
  CompactFormGrid,
  CompactFormSection,
  CompactSelectInput,
  CompactTextInput,
  FormLayout,
} from "@/components/forms";
import { BooleanInput } from "@/components/boolean-input";

const ArticuloDatosGeneralesSection = () => (
  <CompactFormSection>
    <CompactFormGrid columns="two">
      <CompactTextInput
        source="nombre"
        label="Nombre"
        validate={required()}
        className="w-full"
      />
      <ReferenceInput
        source="tipo_articulo_id"
        reference="tipos-articulo"
        label="Tipos de articulo"
        filter={{ activo: true }}
        perPage={200}
      >
        <CompactSelectInput
          optionText="nombre"
          emptyText="Sin tipo"
          className="w-full"
        />
      </ReferenceInput>
      <CompactTextInput
        source="unidad_medida"
        label="Unidad de medida"
        validate={required()}
        className="w-full"
      />
      <CompactTextInput source="marca" label="Marca" className="w-full" />
      <BooleanInput source="activo" label="Activo" />
      <BooleanInput source="generico" label="Generico" />
    </CompactFormGrid>
  </CompactFormSection>
);

const ArticuloComercialSection = () => (
  <CompactFormSection>
    <CompactFormGrid columns="two">
      <CompactTextInput source="sku" label="SKU" className="w-full" />
      <NumberInput
        source="precio"
        label="Precio"
        step={0.01}
        validate={required()}
        className="w-full"
      />
      <div className="md:col-span-2">
        <ReferenceInput
          source="proveedor_id"
          reference="proveedores"
          label="Proveedor (opcional)"
        >
          <CompactSelectInput
            optionText="nombre"
            emptyText="Sin proveedor"
            className="w-full"
          />
        </ReferenceInput>
      </div>
    </CompactFormGrid>
  </CompactFormSection>
);

const ArticuloFormLayout = () => {
  const nombre = useWatch({ name: "nombre" }) as string | undefined;
  const subtitle = nombre ? String(nombre) : "";

  return (
    <FormLayout
      sections={[
        {
          id: "datos-generales",
          title: "Datos del artículo",
          headerContent: subtitle ? (
            <p className="text-[10px] text-muted-foreground sm:text-xs truncate">
              {subtitle}
            </p>
          ) : null,
          headerContentPosition: "below",
          defaultOpen: true,
          contentPadding: "none",
          contentClassName: "space-y-2 px-4 py-2",
          children: <ArticuloDatosGeneralesSection />,
        },
        {
          id: "informacion-comercial",
          title: "Información comercial",
          defaultOpen: true,
          contentPadding: "none",
          contentClassName: "space-y-2 px-4 py-2",
          children: <ArticuloComercialSection />,
        },
      ]}
    />
  );
};

export const ArticuloForm = () => (
  <SimpleForm className="w-full max-w-4xl">
    <ArticuloFormLayout />
  </SimpleForm>
);
