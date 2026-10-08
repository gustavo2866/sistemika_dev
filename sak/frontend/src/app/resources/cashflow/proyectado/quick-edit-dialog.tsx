"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/dataProvider";

type ProjectionValue = {
  periodo: string;
  importe: number;
};

type ProjectionQuickEditResponse = {
  cuenta_cash_id: number;
  cuenta_cash_nombre: string;
  anio: number;
  tipo: "PROYECCION";
  values: ProjectionValue[];
};

export type CashProjectionQuickEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentaCashId: number | null;
  cuentaCashNombre: string;
  startYear: number;
  onSaved?: () => void | Promise<void>;
};

const MILLION = 1_000_000;

const buildMonths = (year: number) => Array.from({ length: 24 }, (_, offset) => {
  const value = new Date(year, offset, 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-01`;
});

const formatMonth = (period: string) => new Intl.DateTimeFormat("es-AR", {
  month: "long",
}).format(new Date(`${period.slice(0, 7)}-01T12:00:00`));

const fetchProjectionValues = async (
  cuentaCashId: number,
  startYear: number,
): Promise<ProjectionQuickEditResponse> => {
  const token = localStorage.getItem("auth_token");
  const params = new URLSearchParams({
    cuenta_cash_id: String(cuentaCashId),
    anio: String(startYear),
  });
  const response = await fetch(`${apiUrl}/erp/cash/proyectado/quick-edit/values?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail || "No se pudieron cargar las proyecciones");
  return result as ProjectionQuickEditResponse;
};

export const CashProjectionQuickEditDialog = ({
  open,
  onOpenChange,
  cuentaCashId,
  cuentaCashNombre,
  startYear,
  onSaved,
}: CashProjectionQuickEditDialogProps) => {
  const notify = useNotify();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const months = useMemo(() => buildMonths(startYear), [startYear]);
  const query = useQuery({
    queryKey: ["erp-cash-proyectado-quick-edit", cuentaCashId, startYear],
    queryFn: () => fetchProjectionValues(cuentaCashId!, startYear),
    enabled: open && cuentaCashId !== null,
  });

  useEffect(() => {
    if (!query.data) return;
    setValues(Object.fromEntries(
      query.data.values.map((item) => [item.periodo, (Number(item.importe || 0) / MILLION).toFixed(2)]),
    ));
  }, [query.data]);

  const handleSave = async () => {
    if (cuentaCashId === null) return;
    setSaving(true);
    try {
      const parsedValues = months.map((periodo) => {
        const rawValue = String(values[periodo] ?? "0").trim().replace(",", ".");
        const numericValue = Number(rawValue || "0");
        if (!Number.isFinite(numericValue)) {
          throw new Error(`El importe de ${periodo.slice(0, 7)} no es válido`);
        }
        return {
          periodo,
          importe: (numericValue * MILLION).toFixed(2),
        };
      });
      const token = localStorage.getItem("auth_token");
      const params = new URLSearchParams({
        cuenta_cash_id: String(cuentaCashId),
        anio: String(startYear),
      });
      const response = await fetch(`${apiUrl}/erp/cash/proyectado/quick-edit/values?${params}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ values: parsedValues }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "No se pudieron guardar las proyecciones");
      await onSaved?.();
      notify(
        `Proyección actualizada: ${result.created} creados, ${result.updated} modificados`,
        { type: "success" },
      );
      onOpenChange(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudieron guardar las proyecciones", {
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderYear = (year: number, yearMonths: string[]) => (
    <section className="min-w-0 rounded-lg border bg-slate-50/60 p-3 dark:bg-slate-950/30">
      <h3 className="mb-2 border-b pb-2 text-center text-sm font-semibold">{year}</h3>
      <div className="space-y-1.5">
        {yearMonths.map((period) => (
          <label key={period} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 text-xs">
            <span className="capitalize text-muted-foreground">{formatMonth(period)}</span>
            <Input
              type="text"
              inputMode="decimal"
              value={values[period] ?? "0.00"}
              onChange={(event) => setValues((current) => ({
                ...current,
                [period]: event.target.value,
              }))}
              className="h-7 text-right text-xs tabular-nums"
              aria-label={`${formatMonth(period)} ${year}, importe en millones`}
              disabled={saving || query.isLoading}
            />
          </label>
        ))}
      </div>
    </section>
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) onOpenChange(nextOpen); }}>
      <DialogContent className="grid max-h-[92vh] !w-[92vw] !max-w-[780px] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 p-4">
        <DialogHeader>
          <DialogTitle className="text-base">Editar proyección</DialogTitle>
          <DialogDescription>
            {cuentaCashNombre} · importes expresados en millones
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          {query.isLoading ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />Cargando proyección…
            </div>
          ) : query.error ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-destructive">
              {query.error instanceof Error ? query.error.message : "No se pudieron cargar los valores"}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {renderYear(startYear, months.slice(0, 12))}
              {renderYear(startYear + 1, months.slice(12, 24))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving || query.isLoading || Boolean(query.error)}>
            {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
            Guardar 24 meses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
