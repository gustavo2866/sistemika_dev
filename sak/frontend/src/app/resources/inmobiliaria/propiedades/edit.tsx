"use client";

import { Edit } from "@/components/edit";
import { useRecordContext } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Home } from "lucide-react";

import { PropiedadForm } from "./form";
import type { Propiedad } from "./model";

export const PropiedadEdit = () => (
  <Edit title={<PropiedadEditTitle />} actions={false}>
    <PropiedadForm />
  </Edit>
);

const PropiedadEditTitle = () => {
  const record = useRecordContext<Propiedad>();
  const estadoCatalogoLabel =
    record?.propiedad_status?.nombre ??
    (record?.propiedad_status_id != null ? `Estado #${record.propiedad_status_id}` : null);
  const vacanciaActivaLabel =
    record?.vacancia_activa === true
      ? "si"
      : record?.vacancia_activa === false
        ? "no"
        : "n/d";
  const vacanciaFechaLabel = record?.vacancia_fecha
    ? new Date(record.vacancia_fecha).toLocaleDateString("es-AR")
    : "n/d";
  const vacanciaLabel = `vacancia: ${vacanciaActivaLabel} ${vacanciaFechaLabel}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-2">
        <Home className="h-4 w-4" />
        Editar propiedad
        {record?.id ? <span className="text-xs text-muted-foreground">#{record.id}</span> : null}
      </span>
      {estadoCatalogoLabel ? (
        <Badge variant="outline">{estadoCatalogoLabel}</Badge>
      ) : null}
      <Badge variant="outline">{vacanciaLabel}</Badge>
    </div>
  );
};
