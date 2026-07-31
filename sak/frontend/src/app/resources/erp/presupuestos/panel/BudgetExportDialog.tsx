"use client";

import { useState } from "react";
import { useNotify } from "ra-core";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiUrl } from "@/lib/dataProvider";

import type { BudgetExportRequest } from "./types";
import { downloadBlobWithAuth, formatMonthLabel } from "./utils";

type BudgetExportDialogProps = {
  request: BudgetExportRequest | null;
  onOpenChange: (open: boolean) => void;
};

export const BudgetExportDialog = ({
  request,
  onOpenChange,
}: BudgetExportDialogProps) => {
  const notify = useNotify();
  const [isExportingBudget, setIsExportingBudget] = useState(false);

  const handleConfirmBudgetExport = async () => {
    if (!request) return;

    setIsExportingBudget(true);
    try {
      const params = new URLSearchParams();
      params.set("periodo", request.month);
      params.set("proyecto_id", String(request.proyecto_id));
      const safeLabel = request.label
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      await downloadBlobWithAuth(
        `${apiUrl}/erp/presupuestos/panel/export?${params.toString()}`,
        `presupuesto-${request.month}-${safeLabel}.xlsx`,
      );
      notify("Presupuesto exportado", { type: "success" });
      onOpenChange(false);
    } catch {
      notify("No se pudo exportar el presupuesto", { type: "error" });
    } finally {
      setIsExportingBudget(false);
    }
  };

  return (
    <AlertDialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open && !isExportingBudget) onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exportar presupuesto</AlertDialogTitle>
          <AlertDialogDescription>
            {request
              ? `Se exportara el presupuesto de ${request.label} para ${formatMonthLabel(request.month)}.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isExportingBudget}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isExportingBudget}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirmBudgetExport();
            }}
          >
            {isExportingBudget ? "Exportando..." : "Exportar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
