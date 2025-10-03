"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";

const tipoArticuloChoices = [
  { id: "Material", name: "Material" },
  { id: "Ferreteria", name: "Ferreteria" },
  { id: "Herramienta", name: "Herramienta" },
  { id: "Sanitario", name: "Sanitario" },
  { id: "Griferia", name: "Griferia" },
  { id: "Perfileria", name: "Perfileria" },
  { id: "Pintura", name: "Pintura" },
  { id: "Sellador", name: "Sellador" },
  { id: "Impermeabilizante", name: "Impermeabilizante" },
];

export const ArticuloForm = () => (
  <SimpleForm className="w-full max-w-4xl">
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="nombre" label="Nombre" isRequired className="w-full" />
      <SelectInput source="tipo_articulo" label="Tipo de articulo" choices={tipoArticuloChoices} className="w-full" />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="unidad_medida" label="Unidad de medida" isRequired className="w-full" />
      <TextInput source="marca" label="Marca" className="w-full" />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="sku" label="SKU" className="w-full" />
      <NumberInput source="precio" label="Precio" step={0.01} isRequired className="w-full" />
    </div>
    <ReferenceInput source="proveedor_id" reference="proveedores" label="Proveedor (opcional)">
      <SelectInput optionText="nombre" emptyText="Sin proveedor" className="w-full" />
    </ReferenceInput>
  </SimpleForm>
);
