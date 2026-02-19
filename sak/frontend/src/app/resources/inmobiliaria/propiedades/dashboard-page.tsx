"use client";

import { useState } from "react";
import { PropiedadesDashboard } from "./dashboard";

const getToday = () => new Date().toISOString().slice(0, 10);

export const PropiedadesDashboardPage = () => {
  const [pivotDate, setPivotDate] = useState(getToday);

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
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Fecha pivot</span>
            <input
              type="date"
              value={pivotDate}
              onChange={(event) => setPivotDate(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            />
          </label>
        </div>
      </div>
      <PropiedadesDashboard
        pivotDate={pivotDate}
        onPivotDateChange={setPivotDate}
      />
    </div>
  );
};

export default PropiedadesDashboardPage;
