"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resolveNumericId } from "@/components/forms/form_order";

import { PROPIEDAD_DIALOG_OVERLAY_CLASS } from "./dialog_styles";
import {
  formatPropiedadOrdenOportunidadLabel,
  type PropiedadOrdenMantenimientoOportunidad,
} from "./form_hooks";

type SeleccionarOportunidadOrdenDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidades: PropiedadOrdenMantenimientoOportunidad[];
  onSelect: (oportunidadId: number) => void;
};

// Permite elegir la oportunidad de mantenimiento sobre la que se creara una orden.
export const SeleccionarOportunidadOrdenDialog = ({
  open,
  onOpenChange,
  oportunidades,
  onSelect,
}: SeleccionarOportunidadOrdenDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className="sm:max-w-md"
      overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
    >
      <DialogHeader className="gap-1">
        <DialogTitle className="text-base leading-none">Seleccionar reparacion</DialogTitle>
        <DialogDescription className="text-[11px] leading-tight sm:text-xs">
          Hay mas de una reparacion abierta. Elige una para la nueva orden.
        </DialogDescription>
      </DialogHeader>
      <div className="flex max-h-[42vh] flex-col gap-1.5 overflow-y-auto pr-1">
        {oportunidades.map((oportunidad) => {
          const oportunidadId = resolveNumericId(oportunidad.id);
          if (!oportunidadId) return null;
          const { title, contacto, createdAt } = formatPropiedadOrdenOportunidadLabel(oportunidad);

          return (
            <button
              key={oportunidadId}
              type="button"
              className="rounded-lg border border-border/70 px-2.5 py-1.5 text-left transition hover:border-primary/40 hover:bg-muted/40"
              onClick={() => {
                onOpenChange(false);
                onSelect(oportunidadId);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium leading-tight text-foreground">
                    {title}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                    {contacto || "Sin contacto"}
                  </div>
                </div>
                <div className="shrink-0 text-[10px] leading-none text-muted-foreground">
                  #{oportunidadId}
                </div>
              </div>
              <div className="mt-1 text-[10px] leading-none text-muted-foreground/90">
                {createdAt ? `Creada: ${createdAt}` : "Sin fecha"}
              </div>
            </button>
          );
        })}
      </div>
    </DialogContent>
  </Dialog>
);
