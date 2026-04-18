"use client";

import { CRMOportunidadList } from "@/app/resources/crm/crm-oportunidades/List";

export const OportunidadesList = ({
  title,
  propiedadId,
  tipoOperacionId,
  storeKey,
}: {
  title: string;
  propiedadId: number;
  tipoOperacionId: number | null;
  storeKey: string;
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
      compact
      showBulkActions={false}
      filterDefaultValues={defaultFilters}
      permanentFilter={permanentFilter}
      storeKey={storeKey}
      emptyMessage={`No hay ${title.toLowerCase()} registradas para esta propiedad.`}
    />
  );
};
