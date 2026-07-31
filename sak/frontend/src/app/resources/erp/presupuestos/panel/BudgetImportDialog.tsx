"use client";

import { useRef, useState } from "react";
import { useNotify } from "ra-core";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiUrl } from "@/lib/dataProvider";

import type { BudgetExportRequest, BudgetImportResponse } from "./types";
import { formatMonthLabel, postFormDataWithAuth } from "./utils";

type BudgetImportDialogProps = {
  request: BudgetExportRequest | null;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void>;
};

export const BudgetImportDialog = ({
  request,
  onOpenChange,
  onImported,
}: BudgetImportDialogProps) => {
  const notify = useNotify();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<BudgetImportResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const reset = () => {
    setFile(null);
    setValidation(null);
    setIsValidating(false);
    setIsProcessing(false);
  };

  const uploadBudget = async (process: boolean) => {
    if (!request || !file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("process", String(process));
    const params = new URLSearchParams();
    params.set("periodo", request.month);
    params.set("proyecto_id", String(request.proyecto_id));

    return postFormDataWithAuth<BudgetImportResponse>(
      `${apiUrl}/erp/presupuestos/panel/import?${params.toString()}`,
      formData,
    );
  };

  const handleValidate = async () => {
    if (!file) return;
    setIsValidating(true);
    try {
      const result = await uploadBudget(false);
      if (!result) return;
      setValidation(result);
      notify(result.valid ? "Archivo validado" : "El archivo tiene errores", {
        type: result.valid ? "success" : "warning",
      });
    } catch {
      notify("No se pudo validar el archivo", { type: "error" });
    } finally {
      setIsValidating(false);
    }
  };

  const handleProcess = async () => {
    if (!file || !validation?.valid) return;
    setIsProcessing(true);
    try {
      const result = await uploadBudget(true);
      if (!result) return;
      setValidation(result);
      notify(`Presupuesto importado (${result.rows_budgeted} items)`, { type: "success" });
      await onImported();
      reset();
      onOpenChange(false);
    } catch {
      notify("No se pudo importar el presupuesto", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open && !isProcessing) reset();
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-[560px] gap-3 p-4">
        <DialogHeader>
          <DialogTitle className="text-base">Importar presupuesto</DialogTitle>
          <div className="text-xs text-muted-foreground">
            {request ? `${formatMonthLabel(request.month)} - ${request.label}` : ""}
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            disabled={isValidating || isProcessing}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setValidation(null);
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              disabled={isValidating || isProcessing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Archivo
            </Button>
            <div className="min-w-0 flex-1 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground">
              <span className="block truncate">
                {file?.name ?? "Ningun archivo seleccionado"}
              </span>
            </div>
          </div>

          {validation ? (
            <div className="rounded-md border border-border bg-muted/20 p-2 text-xs">
              <div className="font-medium">
                {validation.valid ? "Archivo valido" : "Errores detectados"}
              </div>
              <div className="mt-1 text-muted-foreground">
                Filas leidas: {validation.rows_read} - Items a importar:{" "}
                {validation.rows_budgeted}
              </div>
              {validation.errors.length > 0 ? (
                <div className="mt-2 max-h-[180px] overflow-y-auto rounded border bg-background p-2">
                  <ul className="space-y-1">
                    {validation.errors.map((error, index) => (
                      <li key={`${error}-${index}`} className="text-rose-700">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isValidating || isProcessing}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!file || isValidating || isProcessing}
            onClick={() => void handleValidate()}
          >
            {isValidating ? "Validando..." : "Validar"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!validation?.valid || isValidating || isProcessing}
            onClick={() => void handleProcess()}
          >
            {isProcessing ? "Procesando..." : "Procesar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
