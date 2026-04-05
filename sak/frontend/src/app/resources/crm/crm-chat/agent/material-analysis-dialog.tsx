"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { MaterialFamilyEditorDialog } from "./family-editor-dialog";
import { AIReplyResult, MaterialRequestItem, getMaterialRequestItems } from "./types";

type MaterialAnalysisDialogProps = {
  apiUrl: string;
  getAuthHeaders: () => HeadersInit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReply: (message: string) => void;
  result: AIReplyResult | null;
};

export const MaterialAnalysisDialog = ({
  apiUrl,
  getAuthHeaders,
  open,
  onOpenChange,
  onReply,
  result,
}: MaterialAnalysisDialogProps) => {
  const [showJson, setShowJson] = useState(false);
  const [familyEditorItem, setFamilyEditorItem] = useState<MaterialRequestItem | null>(null);
  const items = getMaterialRequestItems(result);
  const timings = result?.debug_timings;
  const requestStatus =
    result?.solicitud?.estado_solicitud?.trim() ||
    (typeof result?.analysis === "object" &&
    result?.analysis &&
    "status" in result.analysis &&
    typeof result.analysis.status === "string"
      ? result.analysis.status
      : "") ||
    "";

  const requestStatusLabel =
    requestStatus === "confirmed"
      ? "Solicitud confirmada"
      : requestStatus === "ready"
        ? "Lista para revision"
        : requestStatus === "needs_clarification"
          ? "Pendiente de aclaracion"
          : requestStatus
            ? requestStatus
            : null;

  const requestStatusClassName =
    requestStatus === "confirmed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : requestStatus === "ready"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  const renderAtributos = (
    atributos?: Record<string, unknown> | null,
    faltantes?: string[] | null,
  ) => {
    const resolvedEntries =
      atributos && typeof atributos === "object"
        ? Object.entries(atributos).filter(([, value]) => value != null && value !== "")
        : [];
    const resolvedKeys = new Set(resolvedEntries.map(([key]) => key));
    const missingEntries = Array.isArray(faltantes)
      ? faltantes
          .filter((key) => key && !resolvedKeys.has(key))
          .map((key) => `${key}: ??`)
      : [];

    const formattedResolved = resolvedEntries.map(([key, value]) => `${key}: ${String(value)}`);
    const allEntries = [...formattedResolved, ...missingEntries];

    if (allEntries.length === 0) return "-";
    return allEntries.join(", ");
  };

  const buildSummaryLine = (item: MaterialRequestItem) => {
    const quantity =
      item.cantidad == null || item.cantidad === "" ? null : String(item.cantidad).trim();
    const unit = item.unidad?.trim() || null;
    const description = item.descripcion_actual?.trim() || item.descripcion_original?.trim() || null;
    const productFromDescription = description
      ? description.replace(/^\s*\d+(?:[.,]\d+)?\s*(?:bolsas?|barras?|m3|metros?|mts?|unidades?|rollos?|kg)\s*(?:de\s+)?/i, "").trim()
      : null;
    const product =
      item.descripcion_normalizada?.trim() ||
      productFromDescription ||
      description ||
      "item";

    const resolvedEntries =
      item.atributos && typeof item.atributos === "object"
        ? Object.entries(item.atributos).filter(([, value]) => value != null && value !== "")
        : [];

    const specs = resolvedEntries
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(", ");

    const mainText =
      quantity || unit
        ? [quantity, unit, product].filter(Boolean).join(" ")
        : (description || product);
    return specs ? `${mainText} (${specs})` : mainText;
  };

  const buildReplyText = () => {
    const consultas = items
      .map((item) => item.consulta?.trim())
      .filter((value): value is string => Boolean(value))
      .slice(0, 3);

    if (consultas.length > 0) {
      if (consultas.length === 1) {
        return consultas[0];
      }
      return `Para completar la solicitud necesito confirmar lo siguiente:\n- ${consultas.join("\n- ")}`;
    }

    const summaryLines = items
      .map(buildSummaryLine)
      .filter((line) => line.trim().length > 0);

    if (summaryLines.length === 0) {
      return "";
    }

    return `Te detallo la solicitud:\n- ${summaryLines.join("\n- ")}\n\n¿Confirmas que la solicitud esta correcta?`;
  };

  const handleReply = () => {
    const replyText = buildReplyText().trim();
    if (!replyText) return;
    onReply(replyText);
    onOpenChange(false);
    setShowJson(false);
    setFamilyEditorItem(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setShowJson(false);
          setFamilyEditorItem(null);
        }
      }}
    >
      <DialogContent
        className="max-w-[calc(100%-2rem)] gap-3 rounded-xl p-3 sm:max-w-[760px]"
        overlayClassName="!bg-transparent !backdrop-blur-none"
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle className="text-sm">Analisis IA de materiales</DialogTitle>
              {requestStatusLabel ? (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${requestStatusClassName}`}
                  >
                    {requestStatusLabel}
                  </span>
                  {result?.solicitud?.version ? (
                    <span className="text-[10px] text-slate-500">
                      v{result.solicitud.version}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {timings ? (
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                  {timings.prompt_ms != null ? <span>prompt {timings.prompt_ms} ms</span> : null}
                  {timings.llm_ms != null ? <span>llm {timings.llm_ms} ms</span> : null}
                  {timings.normalize_ms != null ? <span>norm {timings.normalize_ms} ms</span> : null}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={handleReply}
                disabled={items.length === 0}
              >
                Responder
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setShowJson((prev) => !prev)}
              >
                {showJson ? "Ocultar JSON" : "Ver JSON"}
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="max-h-[50vh] overflow-auto">
              <Table className="w-full table-fixed">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[16%] px-2 py-1.5 text-[9px] leading-3.5">Descripcion</TableHead>
                    <TableHead className="w-[13%] px-2 py-1.5 text-[9px] leading-3.5">Producto</TableHead>
                    <TableHead className="w-[6%] px-2 py-1.5 text-[9px] leading-3.5">Cant</TableHead>
                    <TableHead className="w-[9%] px-2 py-1.5 text-[9px] leading-3.5">Unidad</TableHead>
                    <TableHead className="w-[12%] px-2 py-1.5 text-[9px] leading-3.5">Familia</TableHead>
                    <TableHead className="w-[18%] px-2 py-1.5 text-[9px] leading-3.5">Espec</TableHead>
                    <TableHead className="w-[26%] px-2 py-1.5 text-[9px] leading-3.5">Consulta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="px-2 py-4 text-center text-[9px] text-slate-500">
                        La IA no devolvio items estructurados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => (
                      <TableRow key={`${item.descripcion_original ?? "item"}-${index}`}>
                        <TableCell className="align-top whitespace-normal break-words px-2 py-1 text-[9px] leading-3.5 text-slate-700">
                          {item.descripcion_actual || item.descripcion_original || "-"}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal break-words px-2 py-1 text-[9px] leading-3.5 text-slate-700">
                          {item.descripcion_normalizada || "-"}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal break-words px-2 py-1 text-[9px] leading-3.5 text-slate-700">
                          {item.cantidad == null || item.cantidad === "" ? "-" : String(item.cantidad)}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal break-words px-2 py-1 text-[9px] leading-3.5 text-slate-700">
                          {item.unidad || "-"}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal break-words px-2 py-1 text-[9px] leading-3.5 text-slate-700">
                          {item.familia ? (
                            <button
                              type="button"
                              className="cursor-pointer text-left text-[9px] leading-3.5 text-sky-700 underline decoration-sky-200 underline-offset-2 transition hover:text-sky-900"
                              onClick={() => setFamilyEditorItem(item)}
                            >
                              {item.familia}
                            </button>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal break-words px-2 py-1 text-[9px] leading-3.5 text-slate-700">
                          {renderAtributos(item.atributos, item.faltantes)}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal break-words px-2 py-1 text-[9px] leading-3.5 text-slate-700">
                          {item.consulta || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          {showJson ? (
            <div className="max-h-[24vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <pre className="whitespace-pre-wrap break-words text-[9px] leading-3.5 text-slate-700">
                {JSON.stringify(result ?? {}, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </DialogContent>
      <MaterialFamilyEditorDialog
        apiUrl={apiUrl}
        getAuthHeaders={getAuthHeaders}
        item={familyEditorItem}
        open={Boolean(familyEditorItem)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setFamilyEditorItem(null);
          }
        }}
      />
    </Dialog>
  );
};
