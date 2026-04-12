"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGetList } from "ra-core";
import { PropiedadesDashboard } from "./dashboard";
import { VacanciasPeriodoCard } from "./components/vacancias-periodo-card";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

type QuarterOption = { label: string; startDate: string; endDate: string };

function buildQuarterOptions(count = 5): QuarterOption[] {
  const today = new Date();
  const options: QuarterOption[] = [];
  const year = today.getFullYear();
  const q = Math.floor(today.getMonth() / 3); // 0-based quarter index
  for (let i = 0; i < count; i++) {
    let qq = q - i;
    let yy = year;
    while (qq < 0) { qq += 4; yy--; }
    const startMonth = qq * 3;
    const endDate = new Date(yy, startMonth + 3, 0); // last day of quarter
    const startDate = `${yy}-${String(startMonth + 1).padStart(2, "0")}-01`;
    const endStr = `${yy}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
    options.push({
      label: `T${qq + 1} ${yy} (${MONTHS_ES[startMonth]}-${MONTHS_ES[startMonth + 2]})`,
      startDate,
      endDate: endStr,
    });
  }
  return options;
}

export const PropiedadesDashboardPage = () => {
  const [tipoOperacionId, setTipoOperacionId] = useState("");
  const appliedDefaultTipoRef = useRef(false);

  const quarterOptions = useMemo(() => buildQuarterOptions(5), []);
  // Default to the last complete quarter (index 1 = one quarter before current)
  const defaultQuarterIdx = useMemo(() => {
    const today = new Date();
    const currentQStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    // If we're more than 0 days into the current quarter, default to it (idx 0)
    // but if it just started (< 7 days), prefer the previous (idx 1)
    const daysIntoCurrent = Math.floor((today.getTime() - currentQStart.getTime()) / 86400000);
    return daysIntoCurrent < 7 ? 1 : 0;
  }, []);
  const [selectedQuarterIdx, setSelectedQuarterIdx] = useState(defaultQuarterIdx);
  const selectedQuarter = quarterOptions[selectedQuarterIdx];
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
          Dashboard de Propiedades
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Resumen por estado y tipo de operacion.
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
            <label className="flex items-center gap-2">
              <span>Período</span>
              <select
                value={selectedQuarterIdx}
                onChange={(e) => setSelectedQuarterIdx(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
              >
                {quarterOptions.map((opt, idx) => (
                  <option key={opt.startDate} value={idx}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <VacanciasPeriodoCard
        startDate={selectedQuarter.startDate}
        endDate={selectedQuarter.endDate}
        periodType="trimestre"
        tipoOperacionId={tipoOperacionId || undefined}
      />
      <PropiedadesDashboard
        tipoOperacionId={tipoOperacionId}
      />
    </div>
  );
};

export default PropiedadesDashboardPage;
