"use client";

import { Edit } from "@/components/edit";
import { useRecordContext } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Home } from "lucide-react";

import { PropiedadForm } from "./form";
import { formatEstadoPropiedad, getPropiedadStatusBadgeClass } from "./model";

export const PropiedadEdit = () => (
  <Edit title={<PropiedadEditTitle />}>
    <PropiedadForm />
  </Edit>
);

const PropiedadEditTitle = () => {
  const record = useRecordContext<{ estado?: string | null }>();
  const estadoLabel = formatEstadoPropiedad(record?.estado ?? null);
  const badgeClass = getPropiedadStatusBadgeClass(record?.estado ?? null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-2">
        <Home className="h-4 w-4" />
        Editar propiedad
      </span>
      {record?.estado ? (
        <Badge className={badgeClass}>{estadoLabel}</Badge>
      ) : null}
    </div>
  );
};
