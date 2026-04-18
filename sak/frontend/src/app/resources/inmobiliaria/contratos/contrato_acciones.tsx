"use client";

import { useState } from "react";
import { useGetList } from "ra-core";
import { Ban, CheckCircle, Copy, FileDown, XCircle } from "lucide-react";

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
import { PROPIEDAD_DIALOG_OVERLAY_CLASS } from "../propiedades/dialog_styles";

import { type Contrato, isContratoVencido } from "./model";
import {
  canContratoActivar,
  canContratoRescindir,
} from "./status_transitions";
import {
  useContratoActivar,
  useContratoDuplicar,
  useContratoFinalizar,
  useContratoGenerarPdf,
  useContratoRenovar,
  useContratoRescindir,
} from "./form_hooks";

type ContratoVigenteRelacionado = Pick<
  Contrato,
  "id" | "estado" | "fecha_inicio" | "fecha_vencimiento" | "inquilino_nombre" | "inquilino_apellido"
>;

type AccionActiva = "activar" | "duplicar" | "finalizar" | "rescindir" | null;

export type ContratoAccionesState = {
  record: Contrato | null;
  isVencido: boolean;
  canActivar: boolean;
  canDuplicar: boolean;
  canFinalizar: boolean;
  canRescindir: boolean;
  contratoVigenteAnterior: ContratoVigenteRelacionado | null;
  activationBlockedReason: string | null;
  accionActiva: AccionActiva;
  setAccionActiva: (a: AccionActiva) => void;
  fechaRescision: string;
  setFechaRescision: (v: string) => void;
  motivoRescision: string;
  setMotivoRescision: (v: string) => void;
  handleActivar: () => Promise<void>;
  handleDuplicar: () => Promise<void>;
  handleFinalizar: () => Promise<void>;
  handleRescindir: () => Promise<void>;
  handleGenerarPdf: () => Promise<void>;
  pdfPreviewUrl: string | null;
  pdfPreviewName: string | null;
  pdfPreviewOpen: boolean;
  closePdfPreview: () => void;
  downloadPdfPreview: () => void;
  loading: boolean;
};

export const useContratoAccionesState = (
  record: Contrato | undefined | null,
): ContratoAccionesState => {
  const [accionActiva, setAccionActiva] = useState<AccionActiva>(null);
  const [fechaRescision, setFechaRescision] = useState("");
  const [motivoRescision, setMotivoRescision] = useState("");
  const isVencido = isContratoVencido(record ?? {});
  const { data: contratosVigentes = [] } = useGetList<ContratoVigenteRelacionado>(
    "contratos",
    {
      filter: {
        propiedad_id: record?.propiedad_id,
        estado: "vigente",
      },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "DESC" },
    },
    { enabled: Boolean(record?.propiedad_id) },
  );

  const { activar, loading: lActivar } = useContratoActivar();
  const { duplicar, loading: lDuplicar } = useContratoDuplicar();
  const { finalizar, loading: lFinalizar } = useContratoFinalizar();
  const { renovar, loading: lRenovar } = useContratoRenovar();
  const { rescindir, loading: lRescindir } = useContratoRescindir();
  const {
    generarPdf,
    previewUrl,
    previewName,
    previewOpen,
    closePreview,
    downloadPreview,
  } = useContratoGenerarPdf();

  const loading = lActivar || lDuplicar || lFinalizar || lRenovar || lRescindir;
  const contratoVigenteAnterior =
    contratosVigentes.find((contrato) => Number(contrato.id) !== Number(record?.id)) ?? null;
  const activationBlockedReason = (() => {
    if (!contratoVigenteAnterior?.fecha_vencimiento || !record?.fecha_inicio) return null;
    const fechaInicioNuevo = new Date(record.fecha_inicio);
    const fechaFinAnterior = new Date(contratoVigenteAnterior.fecha_vencimiento);
    if (Number.isNaN(fechaInicioNuevo.getTime()) || Number.isNaN(fechaFinAnterior.getTime())) return null;
    return fechaInicioNuevo < fechaFinAnterior
      ? "La fecha de inicio del nuevo contrato debe ser mayor o igual a la fecha de finalizacion del contrato vigente."
      : null;
  })();

  const handleActivar = async () => {
    if (!record?.id || activationBlockedReason) return;
    const ok = contratoVigenteAnterior ? await renovar(record.id) : await activar(record.id);
    if (ok) setAccionActiva(null);
  };

  const handleDuplicar = async () => {
    if (!record?.id) return;
    const ok = await duplicar(record.id);
    if (ok) setAccionActiva(null);
  };

  const handleFinalizar = async () => {
    if (!record?.id) return;
    const ok = await finalizar(record.id);
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
    isVencido,
    canActivar: canContratoActivar(record?.estado),
    canDuplicar: Boolean(record?.id),
    canFinalizar: isVencido,
    canRescindir: canContratoRescindir(record?.estado),
    contratoVigenteAnterior,
    activationBlockedReason,
    accionActiva,
    setAccionActiva,
    fechaRescision,
    setFechaRescision,
    motivoRescision,
    setMotivoRescision,
    handleActivar,
    handleDuplicar,
    handleFinalizar,
    handleRescindir,
    handleGenerarPdf,
    pdfPreviewUrl: previewUrl,
    pdfPreviewName: previewName,
    pdfPreviewOpen: previewOpen,
    closePdfPreview: closePreview,
    downloadPdfPreview: downloadPreview,
    loading,
  };
};

export const ContratoAccionesMenuItems = ({
  acciones,
}: {
  acciones: ContratoAccionesState;
}) => {
  const menuItemClassName = "gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]";
  const menuItemIconClassName = "mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5";
  const { canActivar, canDuplicar, canFinalizar, canRescindir, isVencido, setAccionActiva, record, handleGenerarPdf } =
    acciones;

  if (!record?.id) return null;
  if (!canActivar && !canDuplicar && !canFinalizar && !canRescindir) return null;

  return (
    <>
      <DropdownMenuItem
        className={menuItemClassName}
        onSelect={() => handleGenerarPdf()}
        data-row-click="ignore"
        onClick={(e) => e.stopPropagation()}
      >
        <FileDown className={menuItemIconClassName} />
        Generar PDF
      </DropdownMenuItem>
      {canActivar && (
        <DropdownMenuItem
          className={menuItemClassName}
          onSelect={() => setAccionActiva("activar")}
          data-row-click="ignore"
          onClick={(e) => e.stopPropagation()}
        >
          <CheckCircle className={menuItemIconClassName} />
          Activar
        </DropdownMenuItem>
      )}
      {canDuplicar && (
        <DropdownMenuItem
          className={menuItemClassName}
          onSelect={() => setAccionActiva("duplicar")}
          data-row-click="ignore"
          onClick={(e) => e.stopPropagation()}
        >
          <Copy className={menuItemIconClassName} />
          Duplicar
        </DropdownMenuItem>
      )}
      {canFinalizar && (
        <DropdownMenuItem
          className={menuItemClassName}
          onSelect={() => setAccionActiva("finalizar")}
          data-row-click="ignore"
          onClick={(e) => e.stopPropagation()}
        >
          <XCircle className={menuItemIconClassName} />
          {isVencido ? "Confirmar fin" : "Finalizar"}
        </DropdownMenuItem>
      )}
      {canRescindir && (
        <DropdownMenuItem
          className={`${menuItemClassName} text-destructive focus:text-destructive`}
          onSelect={() => setAccionActiva("rescindir")}
          data-row-click="ignore"
          onClick={(e) => e.stopPropagation()}
        >
          <Ban className={menuItemIconClassName} />
          Rescindir
        </DropdownMenuItem>
      )}
    </>
  );
};

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
    contratoVigenteAnterior,
    activationBlockedReason,
    handleActivar,
    handleDuplicar,
    handleFinalizar,
    handleRescindir,
    loading,
    isVencido,
    record,
    pdfPreviewOpen,
    pdfPreviewUrl,
    pdfPreviewName,
    closePdfPreview,
    downloadPdfPreview,
  } = acciones;

  const propiedadNombre = record?.propiedad?.nombre ?? "";
  const contratoInquilino = [record?.inquilino_nombre, record?.inquilino_apellido].filter(Boolean).join(" ");

  const closeSimple = () => setAccionActiva(null);
  const closeRescindir = () => {
    setAccionActiva(null);
    setFechaRescision("");
    setMotivoRescision("");
  };
  const stopDialogClick = (event: React.MouseEvent | React.PointerEvent) => {
    event.stopPropagation();
  };

  return (
    <>
      <Dialog open={accionActiva === "activar"} onOpenChange={(o) => !o && closeSimple()}>
        <DialogContent
          overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
          onClick={stopDialogClick}
          onPointerDown={stopDialogClick}
        >
          <DialogHeader>
            <DialogTitle>{contratoVigenteAnterior ? "Activar renovacion" : "Activar contrato"}</DialogTitle>
            <DialogDescription>
              {contratoVigenteAnterior
                ? `${propiedadNombre ? `Se activará el nuevo contrato para "${propiedadNombre}" y se finalizará el contrato vigente anterior. ` : "Se activará el nuevo contrato y se finalizará el contrato vigente anterior. "}La propiedad conservará su estado actual.`
                : `${propiedadNombre ? `Activar el contrato para "${propiedadNombre}". ` : ""}La propiedad quedará marcada como ocupada y se sincronizarán sus datos contractuales.`}
            </DialogDescription>
          </DialogHeader>
          {contratoVigenteAnterior ? (
            <div className="grid gap-3 py-2 text-sm">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Contrato vigente actual
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>ID: #{contratoVigenteAnterior.id}</div>
                  <div>Estado: {contratoVigenteAnterior.estado ?? "-"}</div>
                  <div>
                    Inquilino: {[contratoVigenteAnterior.inquilino_nombre, contratoVigenteAnterior.inquilino_apellido].filter(Boolean).join(" ") || "-"}
                  </div>
                  <div>Inicio: {contratoVigenteAnterior.fecha_inicio ?? "-"}</div>
                  <div>Finalizacion: {contratoVigenteAnterior.fecha_vencimiento ?? "-"}</div>
                  <div>Nuevo inicio: {record?.fecha_inicio ?? "-"}</div>
                </div>
              </div>
              {activationBlockedReason ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {activationBlockedReason}
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeSimple} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleActivar} disabled={loading || Boolean(activationBlockedReason)}>
              {loading ? "Activando..." : contratoVigenteAnterior ? "Finalizar y activar" : "Activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accionActiva === "duplicar"} onOpenChange={(o) => !o && closeSimple()}>
        <DialogContent
          overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
          onClick={stopDialogClick}
          onPointerDown={stopDialogClick}
        >
          <DialogHeader>
            <DialogTitle>Duplicar contrato</DialogTitle>
            <DialogDescription>
              {propiedadNombre
                ? `Se creará un nuevo contrato en borrador para "${propiedadNombre}" usando este contrato como base. `
                : "Se creará un nuevo contrato en borrador usando este contrato como base. "}
              No se copiarán los archivos adjuntos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeSimple} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleDuplicar} disabled={loading}>
              {loading ? "Duplicando..." : "Duplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accionActiva === "finalizar"} onOpenChange={(o) => !o && closeSimple()}>
        <DialogContent
          overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
          onClick={stopDialogClick}
          onPointerDown={stopDialogClick}
        >
          <DialogHeader>
            <DialogTitle>
              {isVencido ? "Confirmar finalizacion" : "Finalizar contrato"}
            </DialogTitle>
            <DialogDescription>
              {isVencido
                ? "El contrato está vencido. Confirmar la finalización marcará la propiedad como Recibida."
                : "Finalizar el contrato en su fecha de vencimiento natural. La propiedad quedará marcada como Recibida."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 text-sm">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Propiedad
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>ID: {record?.propiedad?.id ?? record?.propiedad_id ?? "-"}</div>
                <div>Nombre: {propiedadNombre || "-"}</div>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Contrato a finalizar
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>ID: #{record?.id ?? "-"}</div>
                <div>Estado: {record?.estado ?? "-"}</div>
                <div>Inquilino: {contratoInquilino || "-"}</div>
                <div>Inicio: {record?.fecha_inicio ?? "-"}</div>
                <div>Finalizacion: {record?.fecha_vencimiento ?? "-"}</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeSimple} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleFinalizar} disabled={loading}>
              {loading ? "Finalizando..." : "Finalizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={accionActiva === "rescindir"}
        onOpenChange={(o) => !o && closeRescindir()}
      >
        <DialogContent
          overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
          onClick={stopDialogClick}
          onPointerDown={stopDialogClick}
        >
          <DialogHeader>
            <DialogTitle>Rescindir contrato</DialogTitle>
            <DialogDescription>
              Extincion anticipada del contrato antes de su vencimiento. La propiedad quedará
              marcada como vacante a partir de la fecha indicada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-1 text-sm">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Resumen
              </div>
              <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
                <div>Propiedad: {propiedadNombre || "-"}</div>
                <div>Propiedad ID: {record?.propiedad?.id ?? record?.propiedad_id ?? "-"}</div>
                <div>Contrato: #{record?.id ?? "-"}</div>
                <div>Estado: {record?.estado ?? "-"}</div>
                <div>Inquilino: {contratoInquilino || "-"}</div>
                <div>Inicio: {record?.fecha_inicio ?? "-"}</div>
                <div>Finalizacion: {record?.fecha_vencimiento ?? "-"}</div>
              </div>
            </div>
          </div>
          <div className="grid gap-2 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="fecha-rescision" className="text-sm font-medium">
                Fecha de rescision <span className="text-destructive">*</span>
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
              {loading ? "Rescindiendo..." : "Rescindir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pdfPreviewOpen} onOpenChange={(open) => (!open ? closePdfPreview() : null)}>
        <DialogContent
          className="flex h-[88vh] max-w-5xl flex-col gap-3 p-4"
          overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
        >
          <DialogHeader>
            <DialogTitle>Vista previa PDF</DialogTitle>
            <DialogDescription>
              Revise el documento antes de descargarlo en su equipo.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/60 bg-muted/20">
            {pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                title={pdfPreviewName ?? "Contrato PDF"}
                className="h-full w-full"
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePdfPreview}>
              Cerrar
            </Button>
            <Button onClick={downloadPdfPreview}>
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
