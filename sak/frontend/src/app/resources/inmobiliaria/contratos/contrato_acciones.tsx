"use client";

import { useState } from "react";
import { Ban, CheckCircle, FileDown, RotateCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type Contrato, isContratoVencido } from "./model";
import {
  canContratoActivar,
  canContratoFinalizar,
  canContratoRenovar,
  canContratoRescindir,
} from "./status_transitions";
import {
  useContratoActivar,
  useContratoFinalizar,
  useContratoGenerarPdf,
  useContratoRenovar,
  useContratoRescindir,
} from "./form_hooks";

// ── State hook ────────────────────────────────────────────────────────────────
// El estado vive en el padre (fuera del DropdownMenuContent) para evitar que
// se pierda cuando el dropdown se desmonta al cerrarse.

type AccionActiva = "activar" | "finalizar" | "renovar" | "rescindir" | null;

export type ContratoAccionesState = {
  record: Contrato | null;
  isVencido: boolean;
  canActivar: boolean;
  canFinalizar: boolean;
  canRenovar: boolean;
  canRescindir: boolean;
  accionActiva: AccionActiva;
  setAccionActiva: (a: AccionActiva) => void;
  fechaRescision: string;
  setFechaRescision: (v: string) => void;
  motivoRescision: string;
  setMotivoRescision: (v: string) => void;
  handleActivar: () => Promise<void>;
  handleFinalizar: () => Promise<void>;
  handleRenovar: () => Promise<void>;
  handleRescindir: () => Promise<void>;
  handleGenerarPdf: () => Promise<void>;
  loading: boolean;
};

export const useContratoAccionesState = (
  record: Contrato | undefined | null,
): ContratoAccionesState => {
  const [accionActiva, setAccionActiva] = useState<AccionActiva>(null);
  const [fechaRescision, setFechaRescision] = useState("");
  const [motivoRescision, setMotivoRescision] = useState("");

  const { activar, loading: lActivar } = useContratoActivar();
  const { finalizar, loading: lFinalizar } = useContratoFinalizar();
  const { renovar, loading: lRenovar } = useContratoRenovar();
  const { rescindir, loading: lRescindir } = useContratoRescindir();
  const { generarPdf } = useContratoGenerarPdf();

  const loading = lActivar || lFinalizar || lRenovar || lRescindir;

  const handleActivar = async () => {
    if (!record?.id) return;
    const ok = await activar(record.id);
    if (ok) setAccionActiva(null);
  };

  const handleFinalizar = async () => {
    if (!record?.id) return;
    const ok = await finalizar(record.id);
    if (ok) setAccionActiva(null);
  };

  const handleRenovar = async () => {
    if (!record?.id) return;
    const ok = await renovar(record.id);
    if (ok) setAccionActiva(null);
  };

  const handleRescindir = async () => {
    if (!record?.id || !fechaRescision) return;
    const ok = await rescindir(record.id, {
      fecha_rescision: fechaRescision,
      motivo_rescision: motivoRescision || null,
    });
    if (ok) {
      setAccionActiva(null);
      setFechaRescision("");
      setMotivoRescision("");
    }
  };

  const handleGenerarPdf = async () => {
    if (!record?.id) return;
    await generarPdf(record.id);
  };

  return {
    record: record ?? null,
    isVencido: isContratoVencido(record ?? {}),
    canActivar: canContratoActivar(record?.estado),
    canFinalizar: canContratoFinalizar(record?.estado),
    canRenovar: canContratoRenovar(record?.estado),
    canRescindir: canContratoRescindir(record?.estado),
    accionActiva,
    setAccionActiva,
    fechaRescision,
    setFechaRescision,
    motivoRescision,
    setMotivoRescision,
    handleActivar,
    handleFinalizar,
    handleRenovar,
    handleRescindir,
    handleGenerarPdf,
    loading,
  };
};

// ── Menu items ────────────────────────────────────────────────────────────────
// Renderiza solo los <DropdownMenuItem>. Sin estado propio.
// Se pasa como extraMenuItems en la lista o como actions en el form.

export const ContratoAccionesMenuItems = ({
  acciones,
}: {
  acciones: ContratoAccionesState;
}) => {
  const { canActivar, canFinalizar, canRenovar, canRescindir, isVencido, setAccionActiva, record, handleGenerarPdf } =
    acciones;

  if (!record?.id) return null;
  if (!canActivar && !canFinalizar && !canRenovar && !canRescindir) return null;

  return (
    <>
      <DropdownMenuItem
        className="gap-2 text-xs"
        onSelect={() => handleGenerarPdf()}
        data-row-click="ignore"
        onClick={(e) => e.stopPropagation()}
      >
        <FileDown className="h-3.5 w-3.5" />
        Generar PDF
      </DropdownMenuItem>
      {canActivar && (
        <DropdownMenuItem
          className="gap-2 text-xs"
          onSelect={() => setAccionActiva("activar")}
          data-row-click="ignore"
          onClick={(e) => e.stopPropagation()}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Activar
        </DropdownMenuItem>
      )}
      {canFinalizar && (
        <DropdownMenuItem
          className="gap-2 text-xs"
          onSelect={() => setAccionActiva("finalizar")}
          data-row-click="ignore"
          onClick={(e) => e.stopPropagation()}
        >
          <XCircle className="h-3.5 w-3.5" />
          {isVencido ? "Confirmar fin" : "Finalizar"}
        </DropdownMenuItem>
      )}
      {canRenovar && (
        <DropdownMenuItem
          className="gap-2 text-xs"
          onSelect={() => setAccionActiva("renovar")}
          data-row-click="ignore"
          onClick={(e) => e.stopPropagation()}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Renovar
        </DropdownMenuItem>
      )}
      {canRescindir && (
        <DropdownMenuItem
          className="gap-2 text-xs text-destructive focus:text-destructive"
          onSelect={() => setAccionActiva("rescindir")}
          data-row-click="ignore"
          onClick={(e) => e.stopPropagation()}
        >
          <Ban className="h-3.5 w-3.5" />
          Rescindir
        </DropdownMenuItem>
      )}
    </>
  );
};

// ── Dialogs ───────────────────────────────────────────────────────────────────
// Se renderizan en el padre, fuera del DropdownMenu, para que el estado
// no se pierda cuando el menú se cierra y desmonta su contenido.

export const ContratoAccionesDialogs = ({
  acciones,
}: {
  acciones: ContratoAccionesState;
}) => {
  const {
    accionActiva,
    setAccionActiva,
    fechaRescision,
    setFechaRescision,
    motivoRescision,
    setMotivoRescision,
    handleActivar,
    handleFinalizar,
    handleRenovar,
    handleRescindir,
    loading,
    isVencido,
    record,
  } = acciones;

  const propiedadNombre = record?.propiedad?.nombre ?? "";

  const closeSimple = () => setAccionActiva(null);
  const closeRescindir = () => {
    setAccionActiva(null);
    setFechaRescision("");
    setMotivoRescision("");
  };

  return (
    <>
      {/* Activar */}
      <Dialog open={accionActiva === "activar"} onOpenChange={(o) => !o && closeSimple()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activar contrato</DialogTitle>
            <DialogDescription>
              {propiedadNombre
                ? `Activar el contrato para "${propiedadNombre}". `
                : ""}
              La propiedad quedará marcada como ocupada y se sincronizarán sus datos contractuales.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeSimple} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleActivar} disabled={loading}>
              {loading ? "Activando…" : "Activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalizar */}
      <Dialog open={accionActiva === "finalizar"} onOpenChange={(o) => !o && closeSimple()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isVencido ? "Confirmar finalización" : "Finalizar contrato"}
            </DialogTitle>
            <DialogDescription>
              {isVencido
                ? "El contrato está vencido. Confirmar la finalización marcará la propiedad como vacante."
                : "Finalizar el contrato en su fecha de vencimiento natural. La propiedad quedará marcada como vacante."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeSimple} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleFinalizar} disabled={loading}>
              {loading ? "Finalizando…" : "Finalizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renovar */}
      <Dialog open={accionActiva === "renovar"} onOpenChange={(o) => !o && closeSimple()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renovar contrato</DialogTitle>
            <DialogDescription>
              Se finalizará este contrato y se creará un nuevo borrador para el período siguiente con
              los mismos términos. Podrá ajustar las condiciones antes de activarlo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeSimple} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleRenovar} disabled={loading}>
              {loading ? "Renovando…" : "Renovar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rescindir */}
      <Dialog
        open={accionActiva === "rescindir"}
        onOpenChange={(o) => !o && closeRescindir()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rescindir contrato</DialogTitle>
            <DialogDescription>
              Extinción anticipada del contrato antes de su vencimiento. La propiedad quedará
              marcada como vacante a partir de la fecha indicada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="fecha-rescision" className="text-sm font-medium">
                Fecha de rescisión <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fecha-rescision"
                type="date"
                value={fechaRescision}
                onChange={(e) => setFechaRescision(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="motivo-rescision" className="text-sm font-medium">
                Motivo{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="motivo-rescision"
                type="text"
                placeholder="Ej: acuerdo mutuo, incumplimiento, etc."
                value={motivoRescision}
                onChange={(e) => setMotivoRescision(e.target.value)}
                maxLength={300}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRescindir} disabled={loading}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRescindir}
              disabled={!fechaRescision || loading}
            >
              {loading ? "Rescindiendo…" : "Rescindir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
