"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { Badge } from "@/components/ui/badge";
import { useRecordContext } from "ra-core";

import { getEmprendimientoStatusBadgeClass } from "./model";

export const EmprendimientoShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="nombre" label="Nombre" />
      <TextField source="descripcion" label="Descripción" />
      <TextField source="ubicacion" label="Ubicación" />
      <EstadoBadge />
      <TextField source="fecha_inicio" label="Fecha de inicio" />
      <TextField source="fecha_fin_estimada" label="Fecha estimada" />
      <TextField source="activo" label="Activo" />
    </SimpleShowLayout>
  </Show>
);

const EstadoBadge = () => {
  const record = useRecordContext<{ estado?: string | null }>();
  if (!record?.estado) {
    return <TextField source="estado" label="Estado" />;
  }
  const badgeClass = getEmprendimientoStatusBadgeClass(record.estado);
  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground">Estado</div>
      <Badge className={badgeClass}>{record.estado}</Badge>
    </div>
  );
};
