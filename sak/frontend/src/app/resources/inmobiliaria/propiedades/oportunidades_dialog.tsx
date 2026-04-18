"use client";

import { OportunidadesList } from "./oportunidades_list";

const PropiedadDialogEmptyState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
    {message}
  </div>
);

export const OportunidadesDialogContent = ({
  propiedadId,
  tipoOperacionId,
}: {
  propiedadId?: number | null;
  tipoOperacionId: number | null;
}) => (
  <div className="space-y-3">
    <p className="text-sm text-muted-foreground">
      Seguimiento comercial y operativo asociado a la propiedad.
    </p>
    <div className="max-h-[70vh] overflow-auto">
      {propiedadId ? (
        <OportunidadesList
          title="Oportunidades"
          propiedadId={propiedadId}
          tipoOperacionId={tipoOperacionId}
          storeKey={`crm-oportunidades-dialog-${propiedadId}-tipo-${tipoOperacionId ?? "sin-tipo"}`}
        />
      ) : (
        <PropiedadDialogEmptyState message="Las oportunidades estaran disponibles despues de guardar la propiedad." />
      )}
    </div>
  </div>
);
