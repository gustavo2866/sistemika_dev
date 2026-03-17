"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGetList } from "ra-core";
import { CRMOportunidadesDashboard } from "./dashboard";

export const CRMOportunidadesDashboardPage = () => {
  const [tipoOperacionId, setTipoOperacionId] = useState("");
  const appliedDefaultTipoRef = useRef(false);
  const { data: tiposOperacion = [] } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const alquilerId = useMemo(() => {
    const alquiler = tiposOperacion.find(
      (tipo: any) =>
        tipo?.codigo?.toLowerCase().includes("alquiler") ||
        tipo?.nombre?.toLowerCase().includes("alquiler"),
    );
    return alquiler?.id ? String(alquiler.id) : "";
  }, [tiposOperacion]);

  useEffect(() => {
    if (appliedDefaultTipoRef.current) {
      return;
    }
    if (tipoOperacionId) {
      appliedDefaultTipoRef.current = true;
      return;
    }
    if (!alquilerId) {
      return;
    }
    setTipoOperacionId(alquilerId);
    appliedDefaultTipoRef.current = true;
  }, [alquilerId, tipoOperacionId]);

  return (
    <div className="w-full max-w-none space-y-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Dashboard de Oportunidades
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Resumen por etapa del pipeline.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <span>Operacion</span>
              <select
                value={tipoOperacionId}
                onChange={(event) => setTipoOperacionId(event.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
              >
                {tiposOperacion.map((tipo: any) => (
                  <option key={tipo.id} value={String(tipo.id)}>
                    {tipo.nombre ?? tipo.codigo ?? `Operacion #${tipo.id}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
      <CRMOportunidadesDashboard 
        baseFilter={tipoOperacionId ? { tipo_operacion_id: tipoOperacionId } : {}} 
      />
    </div>
  );
};

export default CRMOportunidadesDashboardPage;
