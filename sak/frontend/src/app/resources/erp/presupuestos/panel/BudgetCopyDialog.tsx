"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiUrl } from "@/lib/dataProvider";

import type { BudgetCopyConcept, BudgetCopyRequest, BudgetCopyResponse } from "./types";
import {
  addMonths,
  buildConceptsUrl,
  fetchJsonWithAuth,
  formatDateParam,
  formatMonthLabel,
  postJsonWithAuth,
} from "./utils";

type BudgetCopyDialogProps = {
  request: BudgetCopyRequest | null;
  onOpenChange: (open: boolean) => void;
  onCopied: () => Promise<void>;
};

const parseMonthKey = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, 1);
};

export const BudgetCopyDialog = ({
  request,
  onOpenChange,
  onCopied,
}: BudgetCopyDialogProps) => {
  const notify = useNotify();
  const [targetPeriod, setTargetPeriod] = useState("");
  const [variations, setVariations] = useState<Record<string, string>>({});
  const [isCopying, setIsCopying] = useState(false);
  const {
    data: concepts = [],
    isLoading: conceptsLoading,
    isError: conceptsError,
  } = useQuery({
    queryKey: ["erp-presupuestos-copy-concepts"],
    queryFn: () => fetchJsonWithAuth<BudgetCopyConcept[]>(buildConceptsUrl()),
    enabled: Boolean(request),
  });

  useEffect(() => {
    if (!request) {
      setTargetPeriod("");
      setVariations({});
      setIsCopying(false);
      return;
    }
    const [year, month] = request.month.split("-").map(Number);
    const nextMonth = year && month ? addMonths(new Date(year, month - 1, 1), 1) : new Date();
    setTargetPeriod(formatDateParam(nextMonth).slice(0, 7));
    setVariations({});
  }, [request]);

  const handleCopy = async () => {
    if (!request || !targetPeriod) return;

    setIsCopying(true);
    try {
      const result = await postJsonWithAuth<BudgetCopyResponse>(
        `${apiUrl}/erp/presupuestos/panel/copy`,
        {
          proyecto_id: request.proyecto_id,
          periodo_origen: request.month,
          periodo_destino: targetPeriod,
          variaciones: concepts.map((concept) => {
            const parsed = Number(variations[String(concept.id)] ?? 0);
            return {
              concepto_id: concept.id,
              porcentaje: Number.isFinite(parsed) ? parsed : 0,
            };
          }),
        },
      );
      notify(
        `Presupuesto copiado (${result.copied_rows} cuentas, ${result.deleted_rows} reemplazadas)`,
        { type: "success" },
      );
      await onCopied();
      onOpenChange(false);
    } catch {
      notify("No se pudo copiar el presupuesto", { type: "error" });
    } finally {
      setIsCopying(false);
    }
  };

  const projectName = request?.projectName ?? request?.label ?? "";
  const targetPeriodLabel = targetPeriod
    ? formatMonthLabel(targetPeriod)
    : "Seleccionar mes";
  const moveTargetPeriod = (amount: number) => {
    const current = parseMonthKey(targetPeriod) ?? new Date();
    setTargetPeriod(formatDateParam(addMonths(current, amount)).slice(0, 7));
  };

  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open && !isCopying) onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-[620px] gap-3 p-4">
        <DialogHeader>
          <DialogTitle className="text-base">Copiar presupuesto</DialogTitle>
          <div className="text-xs text-muted-foreground">
            {request ? `Origen: ${formatMonthLabel(request.month)}` : ""}
            {projectName ? ` - ${projectName}` : ""}
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.25fr)] items-stretch gap-2">
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
              <span className="font-medium text-muted-foreground">Origen</span>
              <div className="mt-0.5 font-semibold tabular-nums">
                {request ? formatMonthLabel(request.month) : ""}
              </div>
            </div>
            <div className="flex items-center px-1 text-xs text-muted-foreground">
              copiar a
            </div>
            <div className="rounded-md border border-border bg-background px-2 py-1.5">
              <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                Destino
              </div>
              <div className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-center overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  disabled={isCopying}
                  className="inline-flex h-8 items-center justify-center border-r border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Mes anterior"
                  title="Mes anterior"
                  onClick={() => moveTargetPeriod(-1)}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <label className="relative block h-8 min-w-0 bg-background">
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-xs font-semibold tabular-nums text-foreground">
                    {targetPeriodLabel}
                  </span>
                  <Input
                    type="month"
                    value={targetPeriod}
                    disabled={isCopying}
                    aria-label="Periodo destino"
                    className="absolute inset-0 h-8 w-full cursor-pointer border-0 bg-transparent px-0 text-center text-xs opacity-0"
                    onChange={(event) => setTargetPeriod(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={isCopying}
                  className="inline-flex h-8 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Mes siguiente"
                  title="Mes siguiente"
                  onClick={() => moveTargetPeriod(1)}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border">
            <div className="border-b bg-muted/30 px-2 py-1 text-xs font-medium">
              Variaciones por concepto
            </div>
            <div className="max-h-[260px] overflow-y-auto p-2">
              {conceptsLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Cargando conceptos...
                </div>
              ) : conceptsError ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No se pudieron cargar conceptos.
                </div>
              ) : concepts.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Sin conceptos activos.
                </div>
              ) : (
                <div className="space-y-1">
                  {concepts.map((concept) => (
                    <label
                      key={concept.id}
                      className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-2 text-xs"
                    >
                      <span className="truncate">{concept.nombre}</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={variations[String(concept.id)] ?? ""}
                          disabled={isCopying}
                          className="h-7 text-right text-xs"
                          placeholder="0"
                          onChange={(event) =>
                            setVariations((current) => ({
                              ...current,
                              [String(concept.id)]: event.target.value,
                            }))
                          }
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isCopying}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!targetPeriod || isCopying || conceptsLoading || conceptsError}
            onClick={() => void handleCopy()}
          >
            {isCopying ? "Copiando..." : "Copiar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
