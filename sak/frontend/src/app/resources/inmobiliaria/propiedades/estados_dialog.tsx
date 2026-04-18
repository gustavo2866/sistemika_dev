"use client";

import { PropiedadesLogStatusList } from "../propiedades_log_status/List";

const PropiedadDialogEmptyState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
    {message}
  </div>
);

export const EstadosDialogContent = ({
  propiedadId,
}: {
  propiedadId?: number;
}) => (
  <div className="space-y-3">
    <p className="text-sm text-muted-foreground">
      Historial de cambios de estado de la propiedad, ordenado del mas reciente al mas antiguo.
    </p>
    <div className="max-h-[70vh] overflow-auto">
      {propiedadId ? (
        <PropiedadesLogStatusList
          embedded
          filterDefaultValues={{ propiedad_id: propiedadId }}
          showEmbeddedHeader={false}
          storeKey={`propiedades-log-status-dialog-${propiedadId}`}
        />
      ) : (
        <PropiedadDialogEmptyState message="El historial de estados estara disponible despues de guardar la propiedad." />
      )}
    </div>
  </div>
);
