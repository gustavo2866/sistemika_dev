"use client";

import { Edit } from "@/components/edit";
import { useRecordContext } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Home } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  loadDashboardReturnMarker,
  saveDashboardReturnMarker,
} from "../propiedades-dashboard/return-state";

import { PropiedadForm } from "./form";
import { getPropiedadStatusBadgeClass, type Propiedad } from "./model";

export const PropiedadEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Edit
      title={<PropiedadEditTitle />}
      actions={false}
      redirect={false}
      mutationOptions={{
        onSuccess: (data) => {
          if (returnTo) {
            const existingReturnMarker = loadDashboardReturnMarker(returnTo);
            saveDashboardReturnMarker(returnTo, {
              ...existingReturnMarker,
              savedAt: Date.now(),
              propiedadId: data?.id ?? existingReturnMarker?.propiedadId,
              refreshAll: true,
            });
            navigate(returnTo, { replace: true });
            return;
          }
          navigate("/propiedades", { replace: true });
        },
      }}
    >
      <PropiedadForm />
    </Edit>
  );
};

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
        <Badge variant="outline" className={getPropiedadStatusBadgeClass(estadoCatalogoLabel)}>
          {estadoCatalogoLabel}
        </Badge>
      ) : null}
      <Badge variant="outline">{vacanciaLabel}</Badge>
    </div>
  );
};
