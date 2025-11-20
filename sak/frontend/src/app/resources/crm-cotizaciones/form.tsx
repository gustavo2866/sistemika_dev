"use client";

import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { NumberInput } from "@/components/number-input";
import { TextInput } from "@/components/text-input";
import { required } from "ra-core";

export const CRMCotizacionForm = () => (
  <SimpleForm>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ReferenceInput source="moneda_origen_id" reference="monedas" label="Moneda origen">
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source="moneda_destino_id" reference="monedas" label="Moneda destino">
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
      <NumberInput source="tipo_cambio" label="Tipo de cambio" validate={required()} className="w-full" />
      <TextInput source="fecha_vigencia" label="Fecha de vigencia" type="date" validate={required()} className="w-full" />
      <TextInput source="fuente" label="Fuente" className="md:col-span-2" />
    </div>
  </SimpleForm>
);
