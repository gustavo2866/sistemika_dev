"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useDataProvider, useGetList, useNotify, useRefresh } from "ra-core";
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
import type { CRMOportunidad } from "../crm-oportunidades/model";

type CotizarFormValues = {
  propiedadId: string;
  tipoPropiedadId: string;
  monto: string;
  monedaId: string;
  condicionPagoId: string;
  formaPagoDescripcion: string;
};

interface CRMOportunidadCotizarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CRMOportunidad | null;
  onCompleted?: () => void;
  disabled?: boolean;
}

interface CRMOportunidadCotizarFormContentProps {
  record: CRMOportunidad | null;
  onCompleted?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  submitLabel?: string;
  active?: boolean;
  FooterComponent?: ComponentType<{ children: ReactNode }>;
}

const DefaultFooter = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center justify-end gap-2 pt-2">{children}</div>
);

export const CRMOportunidadCotizarFormContent = ({
  record,
  onCompleted,
  onCancel,
  disabled = false,
  submitLabel = "Guardar y avanzar",
  active = true,
  FooterComponent = DefaultFooter,
}: CRMOportunidadCotizarFormContentProps) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<CotizarFormValues>({
    propiedadId: "",
    tipoPropiedadId: "",
    monto: "",
    monedaId: "",
    condicionPagoId: "",
    formaPagoDescripcion: "",
  });

  const { data: propiedadesData = [] } = useGetList("propiedades", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: tiposPropiedadData = [] } = useGetList("tipos-propiedad", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: monedasData = [] } = useGetList("monedas", {
    pagination: { page: 1, perPage: 50 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: condicionesPagoData = [] } = useGetList("crm/catalogos/condiciones-pago", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "nombre", order: "ASC" },
  });

  const propiedadesChoices = useMemo(
    () =>
      propiedadesData.map((item: any) => ({
        value: String(item.id),
        label: item.nombre ?? `Propiedad #${item.id}`,
      })),
    [propiedadesData]
  );

  const tiposPropiedadChoices = useMemo(
    () =>
      tiposPropiedadData.map((item: any) => ({
        value: String(item.id),
        label: item.nombre ?? `Tipo #${item.id}`,
      })),
    [tiposPropiedadData]
  );

  const monedasChoices = useMemo(
    () =>
      monedasData.map((item: any) => ({
        value: String(item.id),
        label: item.nombre ?? item.codigo ?? `Moneda #${item.id}`,
      })),
    [monedasData]
  );

  const condicionesChoices = useMemo(
    () =>
      condicionesPagoData.map((item: any) => ({
        value: String(item.id),
        label: item.nombre ?? `Condicion #${item.id}`,
      })),
    [condicionesPagoData]
  );

  useEffect(() => {
    if (!active) return;
    if (!record) {
      setFormValues({
        propiedadId: "",
        tipoPropiedadId: "",
        monto: "",
        monedaId: "",
        condicionPagoId: "",
        formaPagoDescripcion: "",
      });
      return;
    }
    setFormValues({
      propiedadId: record.propiedad_id ? String(record.propiedad_id) : "",
      tipoPropiedadId: record.tipo_propiedad_id ? String(record.tipo_propiedad_id) : "",
      monto: record.monto != null ? String(record.monto) : "",
      monedaId: record.moneda_id ? String(record.moneda_id) : "",
      condicionPagoId: record.condicion_pago_id ? String(record.condicion_pago_id) : "",
      formaPagoDescripcion: record.forma_pago_descripcion ?? "",
    });
  }, [active, record]);

  useEffect(() => {
    if (!active) return;
    if (!formValues.monedaId && monedasChoices.length > 0) {
      setFormValues((prev) => ({ ...prev, monedaId: monedasChoices[0].value }));
    }
  }, [active, formValues.monedaId, monedasChoices]);

  const handleSubmit = async () => {
    if (!record) return;
    if (!formValues.propiedadId || !formValues.monto || !formValues.monedaId) {
      notify("Por favor completa todos los campos requeridos", { type: "warning" });
      return;
    }

    setIsSubmitting(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: {
          propiedad_id: Number(formValues.propiedadId),
          tipo_propiedad_id: formValues.tipoPropiedadId ? Number(formValues.tipoPropiedadId) : null,
          monto: parseFloat(formValues.monto),
          moneda_id: Number(formValues.monedaId),
          condicion_pago_id: formValues.condicionPagoId ? Number(formValues.condicionPagoId) : null,
          forma_pago_descripcion: formValues.formaPagoDescripcion || null,
          estado: "3-cotiza",
          fecha_estado: new Date().toISOString(),
        },
        previousData: record,
      });

      notify("Cotizacion registrada exitosamente", { type: "success" });
      refresh();
      onCompleted?.();
      onCancel?.();
    } catch (error: any) {
      notify(error.message || "Error al registrar la cotizacion", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const Footer = FooterComponent ?? DefaultFooter;

  return (
    <>
      <div className="space-y-3 py-1 text-left">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Propiedad</Label>
            <select
              value={formValues.propiedadId}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, propiedadId: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <option value="">Sin asignar</option>
              {propiedadesChoices.map((option) => (
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
                setFormValues((prev) => ({ ...prev, tipoPropiedadId: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <option value="">Sin asignar</option>
              {tiposPropiedadChoices.map((option) => (
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
                setFormValues((prev) => ({ ...prev, monto: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Moneda</Label>
            <select
              value={formValues.monedaId}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, monedaId: event.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <option value="">Sin asignar</option>
              {monedasChoices.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Condicion de pago</Label>
          <select
            value={formValues.condicionPagoId}
            onChange={(event) =>
              setFormValues((prev) => ({ ...prev, condicionPagoId: event.target.value }))
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
          >
            <option value="">Sin asignar</option>
            {condicionesChoices.map((option) => (
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
              setFormValues((prev) => ({ ...prev, formaPagoDescripcion: event.target.value }))
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
            placeholder="Notas adicionales"
          />
        </div>
      </div>
      <Footer>
        <Button variant="outline" onClick={onCancel} disabled={disabled || isSubmitting}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={disabled || isSubmitting}>
          {disabled || isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
        </Button>
      </Footer>
    </>
  );
};

export const CRMOportunidadCotizarDialog = ({
  open,
  onOpenChange,
  record,
  onCompleted,
  disabled = false,
}: CRMOportunidadCotizarDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onClick={(event) => event.stopPropagation()} className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Actualizar cotizacion</DialogTitle>
        <DialogDescription>Completa los datos de cotizacion para avanzar la oportunidad.</DialogDescription>
      </DialogHeader>
      <CRMOportunidadCotizarFormContent
        record={record}
        active={open}
        onCompleted={onCompleted}
        onCancel={() => onOpenChange(false)}
        disabled={disabled}
        FooterComponent={DialogFooter}
      />
    </DialogContent>
  </Dialog>
);

export default CRMOportunidadCotizarDialog;
