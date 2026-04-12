"use client";

import { useRecordContext } from "ra-core";
import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { Badge } from "@/components/ui/badge";
import { CONTRATO_ESTADO_BADGES, getContratoEstadoLabel, type Contrato } from "./model";

const EstadoBadge = () => {
  const record = useRecordContext<Contrato>();
  const estado = record?.estado ?? "borrador";
  const badgeClass = CONTRATO_ESTADO_BADGES[estado] ?? "bg-gray-100 text-gray-600";
  return (
    <Badge variant="outline" className={`text-[11px] ${badgeClass}`}>
      {getContratoEstadoLabel(estado)}
    </Badge>
  );
};

export const ContratoShow = () => (
  <Show>
    <SimpleShowLayout>
      <EstadoBadge />
      <TextField source="propiedad.nombre" label="Propiedad" />
      <TextField source="tipo_contrato.nombre" label="Tipo de contrato" />
      <TextField source="tipo_actualizacion.nombre" label="Tipo de actualizacion" />
      <TextField source="fecha_inicio" label="Fecha de inicio" />
      <TextField source="fecha_vencimiento" label="Fecha de vencimiento" />
      <TextField source="fecha_renovacion" label="Fecha de renovacion" />
      <TextField source="duracion_meses" label="Duracion (meses)" />
      <TextField source="valor_alquiler" label="Valor alquiler" />
      <TextField source="expensas" label="Expensas" />
      <TextField source="deposito_garantia" label="Deposito garantia" />
      <TextField source="moneda" label="Moneda" />
      <TextField source="inquilino_nombre" label="Inquilino nombre" />
      <TextField source="inquilino_apellido" label="Inquilino apellido" />
      <TextField source="inquilino_dni" label="Inquilino DNI" />
      <TextField source="inquilino_email" label="Inquilino email" />
      <TextField source="inquilino_telefono" label="Inquilino telefono" />
      <TextField source="garante1_nombre" label="Garante 1 nombre" />
      <TextField source="garante1_apellido" label="Garante 1 apellido" />
      <TextField source="garante2_nombre" label="Garante 2 nombre" />
      <TextField source="garante2_apellido" label="Garante 2 apellido" />
      <TextField source="observaciones" label="Observaciones" />
      <TextField source="fecha_rescision" label="Fecha rescision" />
      <TextField source="motivo_rescision" label="Motivo rescision" />
    </SimpleShowLayout>
  </Show>
);
