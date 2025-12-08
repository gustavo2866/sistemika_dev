"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Option {
  value: string;
  label: string;
}

interface CRMOportunidadCotizarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formValues: {
    propiedadId: string;
    tipoPropiedadId: string;
    monto: string;
    monedaId: string;
    condicionPagoId: string;
    formaPagoDescripcion: string;
  };
  onFormChange: (
    updater:
      | CRMOportunidadCotizarDialogProps["formValues"]
      | ((
          prev: CRMOportunidadCotizarDialogProps["formValues"],
        ) => CRMOportunidadCotizarDialogProps["formValues"]),
  ) => void;
  propiedades: Option[];
  tiposPropiedad: Option[];
  monedas: Option[];
  condicionesPago: Option[];
  onSubmit: () => void;
  disabled?: boolean;
}

export const CRMOportunidadCotizarDialog = ({
  open,
  onOpenChange,
  formValues,
  onFormChange,
  propiedades,
  tiposPropiedad,
  monedas,
  condicionesPago,
  onSubmit,
  disabled = false,
}: CRMOportunidadCotizarDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onClick={(event) => event.stopPropagation()} className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Actualizar cotización</DialogTitle>
        <DialogDescription>Completa los datos de cotización para avanzar la oportunidad.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-1 text-left">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Propiedad</Label>
            <select
              value={formValues.propiedadId}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, propiedadId: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <option value="">Sin asignar</option>
              {propiedades.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Tipo de propiedad</Label>
            <select
              value={formValues.tipoPropiedadId}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, tipoPropiedadId: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <option value="">Sin asignar</option>
              {tiposPropiedad.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Monto</Label>
            <input
              type="number"
              value={formValues.monto}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, monto: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Moneda</Label>
            <select
              value={formValues.monedaId}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, monedaId: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <option value="">Sin asignar</option>
              {monedas.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Condición de pago</Label>
          <select
            value={formValues.condicionPagoId}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, condicionPagoId: event.target.value }))
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
          >
            <option value="">Sin asignar</option>
            {condicionesPago.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Detalle forma de pago</Label>
          <textarea
            rows={3}
            value={formValues.formaPagoDescripcion}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, formaPagoDescripcion: event.target.value }))
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            placeholder="Notas adicionales"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={disabled}>
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar y avanzar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default CRMOportunidadCotizarDialog;
