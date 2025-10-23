"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { ArrayInput } from "@/components/array-input";
import { SimpleFormIterator } from "@/components/simple-form-iterator";
import { NumberInput } from "@/components/number-input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RaRecord } from "ra-core";

export const solicitudTipoChoices = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Compra Directa" },
];

export type SolicitudDetalleFormValue = {
  id?: number;
  articulo_id?: number | null;
  descripcion?: string;
  unidad_medida?: string | null;
  cantidad?: number | string | null;
};

export type SolicitudFormValues = {
  id?: number;
  tipo?: "normal" | "directa";
  fecha_necesidad?: string;
  comentario?: string | null;
  solicitante_id?: number | string;
  detalles?: SolicitudDetalleFormValue[];
};

type SolicitudRecord = RaRecord & {
  tipo?: string;
  fecha_necesidad?: string;
  comentario?: string | null;
  solicitante_id?: number;
  detalles?: SolicitudDetalleFormValue[];
};

export const SolicitudForm = () => (
  <SimpleForm
    className="w-full max-w-5xl space-y-6"
    defaultValues={(record?: SolicitudRecord) => ({
      tipo: record?.tipo ?? "normal",
      fecha_necesidad: record?.fecha_necesidad ?? "",
      comentario: record?.comentario ?? "",
      solicitante_id: record?.solicitante_id ?? undefined,
      detalles: mapDetalleRecords(record?.detalles ?? []),
    })}
  >
    <SolicitudFormFields />
  </SimpleForm>
);

const SolicitudFormFields = () => {
  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Información General</h3>
            <p className="text-sm text-muted-foreground">
              Datos principales de la solicitud
            </p>
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <SelectInput
              source="tipo"
              label="Tipo"
              choices={solicitudTipoChoices}
              className="w-full"
            />
            <TextInput
              source="fecha_necesidad"
              label="Fecha de Necesidad"
              type="date"
              validate={required()}
              className="w-full"
            />
          </div>
          <ReferenceInput
            source="solicitante_id"
            reference="users"
            label="Solicitante"
          >
            <SelectInput optionText="nombre" className="w-full" validate={required()} />
          </ReferenceInput>
          <TextInput
            source="comentario"
            label="Comentario"
            multiline
            rows={3}
            className="w-full"
          />
        </div>
      </Card>

      {/* Detalle */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Detalle de Artículos</h3>
            <p className="text-sm text-muted-foreground">
              Agrega los artículos solicitados con sus cantidades y precios
            </p>
          </div>
          <Separator />
          <ArrayInput
            source="detalles"
            label={false}
          >
            <SimpleFormIterator inline={false} className="space-y-3">
              <DetalleIteratorItem />
            </SimpleFormIterator>
          </ArrayInput>
        </div>
      </Card>
    </div>
  );
};

const DetalleIteratorItem = () => (
  <div className="rounded-lg border p-4 space-y-4">
    <TextInput source="id" label={false} type="hidden" className="hidden" />
    <div className="grid gap-3 md:grid-cols-2">
      <ReferenceInput 
        source="articulo_id" 
        reference="articulos" 
        label="Artículo"
      >
        <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
      </ReferenceInput>
      <TextInput
        source="descripcion"
        label="Descripción"
        validate={required()}
        placeholder="Describe la necesidad"
        className="w-full"
      />
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <TextInput
        source="unidad_medida"
        label="Unidad de Medida"
        className="w-full"
      />
      <NumberInput
        source="cantidad"
        label="Cantidad"
        min={0.001}
        step={0.001}
        validate={required()}
        className="w-full"
      />
    </div>
  </div>
);

const mapDetalleRecords = (detalles: SolicitudDetalleFormValue[] = []) =>
  detalles.map((detalle) => ({
    id: detalle.id,
    articulo_id: detalle.articulo_id ?? undefined,
    descripcion: detalle.descripcion ?? "",
    unidad_medida: detalle.unidad_medida ?? "",
    cantidad: detalle.cantidad ?? 0,
  }));
