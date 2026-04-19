"use client";

import { CRMOportunidadList } from "@/app/resources/crm/crm-oportunidades/List";
import type { ReactNode } from "react";

export const OportunidadesList = ({
  title,
  propiedadId,
  tipoOperacionId,
  storeKey,
  embeddedTitle,
}: {
  title: string;
  propiedadId: number;
  tipoOperacionId: number | null;
  storeKey: string;
  embeddedTitle?: ReactNode | string | false;
}) => {
  const defaultFilters = {
    propiedad_id: propiedadId,
    tipo_operacion_id: tipoOperacionId ?? null,
  };
  const permanentFilter = {
    propiedad_id: propiedadId,
    ...(tipoOperacionId ? { tipo_operacion_id: tipoOperacionId } : {}),
  };

  return (
    <CRMOportunidadList
      key={storeKey}
      embedded
      propiedadId={propiedadId}
      tipoOperacionId={tipoOperacionId}
      showEmbeddedHeader
      embeddedTitle={embeddedTitle ?? title}
      compact
      showBulkActions={false}
      filterDefaultValues={defaultFilters}
      permanentFilter={permanentFilter}
      storeKey={storeKey}
      emptyMessage={`No hay ${title.toLowerCase()} registradas para esta propiedad.`}
    />
  );
};
