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

import type { BudgetClearRequest, BudgetClearResponse } from "./types";
import { formatMonthLabel, postJsonWithAuth } from "./utils";

type BudgetClearDialogProps = {
  request: BudgetClearRequest | null;
  onOpenChange: (open: boolean) => void;
  onCleared: () => Promise<void>;
};

export const BudgetClearDialog = ({
  request,
  onOpenChange,
  onCleared,
}: BudgetClearDialogProps) => {
  const notify = useNotify();
  const [isClearing, setIsClearing] = useState(false);

  const handleClear = async () => {
    if (!request) return;

    setIsClearing(true);
    try {
      const result = await postJsonWithAuth<BudgetClearResponse>(
        `${apiUrl}/erp/presupuestos/panel/clear`,
        {
          proyecto_id: request.proyecto_id,
          periodo: request.month,
        },
      );
      notify(`Presupuesto limpiado (${result.deleted_rows} registros)`, {
        type: "success",
      });
      await onCleared();
      onOpenChange(false);
    } catch {
      notify("No se pudo limpiar el presupuesto", { type: "error" });
    } finally {
      setIsClearing(false);
    }
  };

  const projectName = request?.projectName ?? request?.label ?? "";

  return (
    <AlertDialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open && !isClearing) onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Limpiar presupuesto</AlertDialogTitle>
          <AlertDialogDescription>
            {request
              ? `Se eliminara el presupuesto de ${projectName} para ${formatMonthLabel(request.month)}. Esta accion no elimina los movimientos reales.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClearing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isClearing}
            onClick={(event) => {
              event.preventDefault();
              void handleClear();
            }}
          >
            {isClearing ? "Limpiando..." : "Limpiar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
