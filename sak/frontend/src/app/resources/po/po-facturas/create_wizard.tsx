"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FormDialog } from "@/components/forms";
import { CompactComboboxQuery, CompactFormField, CompactFormGrid } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/forms/combobox";
import { useDataProvider, useGetOne } from "ra-core";
import { CompactOportunidadSelector } from "../../crm-oportunidades";
import {
  ARTICULOS_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  PROVEEDORES_REFERENCE,
  TIPO_COMPRA_CHOICES,
  TIPOS_COMPROBANTE_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
} from "./model";
import { getArticuloFilterByTipo, normalizeId, normalizeNumber } from "../shared/po-utils";
import type { TipoSolicitud } from "../../tipos-solicitud/model";

type WizardValues = {
  proveedorId: string;
  tipoSolicitudId: string;
  departamentoId: string;
  tipoCompra: string;
  tipoComprobanteId: string;
  puntoVenta: string;
  numero: string;
  fechaEmision: string;
  fechaVencimiento: string;
  articuloId: string;
  descripcion: string;
  oportunidadId: string;
  cantidad: string;
  precio: string;
};

type WizardErrors = {
  numero?: string;
  puntoVenta?: string;
  fechaEmision?: string;
  tipoComprobanteId?: string;
};

export type CreateWizardPayload = {
  proveedorId: number | null;
  tipoSolicitudId: number | null;
  departamentoId: number | null;
  tipoCompra: string | null;
  tipoComprobanteId: number | null;
  puntoVenta: string;
  numero: string;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  articuloId: number | null;
  descripcion: string;
  oportunidadId: number | null;
  cantidad: number | null;
  precio: number | null;
  unidadMedida: string | null;
};

const defaultValues: WizardValues = {
  proveedorId: "",
  tipoSolicitudId: "",
  departamentoId: "",
  tipoCompra: "normal",
  tipoComprobanteId: "",
  puntoVenta: "",
  numero: "",
  fechaEmision: "",
  fechaVencimiento: "",
  articuloId: "",
  descripcion: "",
  oportunidadId: "",
  cantidad: "1",
  precio: "",
};

const toWizardValue = (value?: number | null) =>
  value && Number.isFinite(value) ? String(value) : "";

const CreateWizardComponent = ({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (payload: CreateWizardPayload) => void;
}) => {
  const [values, setValues] = useState<WizardValues>(defaultValues);
  const dataProvider = useDataProvider();
  const [errors, setErrors] = useState<WizardErrors>({});
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const proveedorId = normalizeId(values.proveedorId);
  const { data: proveedorData } = useGetOne(
    "proveedores",
    { id: proveedorId ?? 0 },
    { enabled: proveedorId != null }
  );

  const articuloId = normalizeId(values.articuloId);
  const { data: articuloData } = useGetOne(
    "articulos",
    { id: articuloId ?? 0 },
    { enabled: articuloId != null }
  );

  const unidadMedida =
    (articuloData as { unidad_medida?: string } | undefined)?.unidad_medida ?? null;

  useEffect(() => {
    if (!open) {
      setValues(defaultValues);
      setErrors({});
      return;
    }
    setValues((prev) => ({
      ...prev,
      fechaEmision: prev.fechaEmision || today,
    }));
  }, [open, today]);

  useEffect(() => {
    if (!proveedorData) return;
    setValues((prev) => ({
      ...prev,
      tipoSolicitudId: toWizardValue((proveedorData as any)?.default_tipo_solicitud_id),
      departamentoId: toWizardValue((proveedorData as any)?.default_departamento_id),
      articuloId: toWizardValue((proveedorData as any)?.default_articulos_id),
    }));
  }, [proveedorData]);

  const { data: tiposSolicitudData } = useQuery<TipoSolicitud[]>({
    queryKey: ["tipos-solicitud", "wizard"],
    queryFn: async () => {
      const { data } = await dataProvider.getList(
        TIPOS_SOLICITUD_REFERENCE.resource,
        {
          pagination: { page: 1, perPage: TIPOS_SOLICITUD_REFERENCE.limit },
          sort: { field: "nombre", order: "ASC" },
          filter: {},
          meta: { __expanded_list_relations__: ["tipo_articulo_filter_rel"] },
        }
      );
      return data as TipoSolicitud[];
    },
    staleTime: TIPOS_SOLICITUD_REFERENCE.staleTime,
  });

  const articuloFilterId = useMemo(
    () =>
      getArticuloFilterByTipo(
        values.tipoSolicitudId ? String(values.tipoSolicitudId) : undefined,
        tiposSolicitudData ?? [],
      ),
    [values.tipoSolicitudId, tiposSolicitudData],
  );

  const articuloFilterQuery = useMemo(
    () => (articuloFilterId ? { tipo_articulo_id: articuloFilterId } : undefined),
    [articuloFilterId],
  );

  const importe = useMemo(() => {
    const cantidad = Number(values.cantidad || 0);
    const precio = Number(values.precio || 0);
    if (!Number.isFinite(cantidad) || !Number.isFinite(precio)) return 0;
    return Number((cantidad * precio).toFixed(2));
  }, [values.cantidad, values.precio]);

  const handleApply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: WizardErrors = {};
    if (!values.numero.trim()) {
      nextErrors.numero = "El numero es obligatorio";
    }
    if (!values.puntoVenta.trim()) {
      nextErrors.puntoVenta = "El punto es obligatorio";
    }
    if (!values.fechaEmision) {
      nextErrors.fechaEmision = "La fecha es obligatoria";
    }
    if (!values.tipoComprobanteId) {
      nextErrors.tipoComprobanteId = "El comprobante es obligatorio";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const payload: CreateWizardPayload = {
      proveedorId: normalizeId(values.proveedorId),
      tipoSolicitudId: normalizeId(values.tipoSolicitudId),
      departamentoId: normalizeId(values.departamentoId),
      tipoCompra: values.tipoCompra || null,
      tipoComprobanteId: normalizeId(values.tipoComprobanteId),
      puntoVenta: values.puntoVenta,
      numero: values.numero,
      fechaEmision: values.fechaEmision || null,
      fechaVencimiento: values.fechaVencimiento || null,
      articuloId: normalizeId(values.articuloId),
      descripcion: values.descripcion,
      oportunidadId: normalizeId(values.oportunidadId),
      cantidad: normalizeNumber(values.cantidad),
      precio: normalizeNumber(values.precio),
      unidadMedida,
    };
    onApply(payload);
    onOpenChange(false);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Asistente de creación"
      description="Completa los datos minimos para generar una factura."
      contentClassName="sm:max-w-5xl"
      compact={false}
      onSubmit={handleApply}
      onCancel={() => onOpenChange(false)}
      submitLabel="Aplicar"
    >
      <CompactFormGrid columns="one" className="gap-0.5 sm:gap-1">
        <CompactFormField label="Proveedor" required>
          <CompactComboboxQuery
            {...PROVEEDORES_REFERENCE}
            value={values.proveedorId}
            onChange={(value) =>
              setValues((prev) => ({ ...prev, proveedorId: value }))
            }
            placeholder="Selecciona proveedor"
            clearable
          />
        </CompactFormField>

        <div className="wizard-compact rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <div className="grid grid-cols-[140px_1fr] gap-2 sm:gap-3">
            <CompactFormField label="Comprobante" required error={errors.tipoComprobanteId}>
              <CompactComboboxQuery
                {...TIPOS_COMPROBANTE_REFERENCE}
                value={values.tipoComprobanteId}
                onChange={(value) =>
                  setValues((prev) => ({ ...prev, tipoComprobanteId: value }))
                }
                placeholder="Tipo comprobante"
                className="h-7 w-full px-2 text-[10px] sm:h-7 sm:px-2 sm:text-[11px]"
              />
            </CompactFormField>
            <CompactFormField label="Fecha emision" required error={errors.fechaEmision}>
              <Input
                type="date"
                className="h-7 px-2 text-[10px] sm:h-7 sm:px-2 sm:text-[11px]"
                value={values.fechaEmision}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, fechaEmision: event.target.value }))
                }
                onBlur={() =>
                  setErrors((prev) => ({ ...prev, fechaEmision: undefined }))
                }
              />
            </CompactFormField>
          </div>
          <div className="mt-2 grid grid-cols-[120px_1fr] gap-2 sm:gap-3">
            <CompactFormField label="Punto" required error={errors.puntoVenta}>
              <Input
                className="h-7 px-2 text-[10px] sm:h-7 sm:px-2 sm:text-[11px]"
                value={values.puntoVenta}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, puntoVenta: event.target.value }))
                }
                onBlur={() =>
                  setErrors((prev) => ({ ...prev, puntoVenta: undefined }))
                }
              />
            </CompactFormField>
            <CompactFormField label="Numero" required error={errors.numero}>
              <Input
                className="h-7 px-2 text-[10px] sm:h-7 sm:px-2 sm:text-[11px]"
                value={values.numero}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, numero: event.target.value }))
                }
                onBlur={() =>
                  setErrors((prev) => ({ ...prev, numero: undefined }))
                }
              />
            </CompactFormField>
          </div>
        </div>

        <CompactFormGrid columns="two">
          <CompactFormField label="Fecha vencimiento">
            <Input
              type="date"
              className="h-7 px-2 text-[10px] sm:h-7 sm:px-2 sm:text-[11px]"
              value={values.fechaVencimiento}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, fechaVencimiento: event.target.value }))
              }
            />
          </CompactFormField>
        </CompactFormGrid>

        <div className="wizard-compact rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <div className="grid grid-cols-[1.6fr_1.2fr_0.8fr] items-end gap-2 sm:gap-3">
            <CompactFormField
              label="Tipo de solicitud"
              className="wizard-inline-field min-w-0"
            >
              <CompactComboboxQuery
                {...TIPOS_SOLICITUD_REFERENCE}
                value={values.tipoSolicitudId}
                onChange={(value) =>
                  setValues((prev) => ({ ...prev, tipoSolicitudId: value }))
                }
                placeholder="Selecciona tipo"
                className="h-7 w-full px-2 text-[10px] sm:h-8 sm:px-3 sm:text-[11px] [&_span]:text-[10px] sm:[&_span]:text-[11px]"
              />
            </CompactFormField>

            <CompactFormField
              label="Departamento"
              className="wizard-inline-field min-w-0"
            >
              <CompactComboboxQuery
                {...DEPARTAMENTOS_REFERENCE}
                value={values.departamentoId}
                onChange={(value) =>
                  setValues((prev) => ({ ...prev, departamentoId: value }))
                }
                placeholder="Selecciona departamento"
                className="h-7 w-full px-2 text-[10px] sm:h-8 sm:px-3 sm:text-[11px] [&_span]:text-[10px] sm:[&_span]:text-[11px]"
              />
            </CompactFormField>

            <CompactFormField label="Tipo" className="wizard-inline-field min-w-0">
              <Combobox
                options={TIPO_COMPRA_CHOICES.map((choice) => ({
                  id: String(choice.id),
                  nombre: choice.name,
                }))}
                value={values.tipoCompra}
                onChange={(value) =>
                  setValues((prev) => ({ ...prev, tipoCompra: value }))
                }
                placeholder="Selecciona tipo"
                className="h-7 w-full px-2 text-[10px] sm:h-8 sm:px-3 sm:text-[11px] [&_span]:text-[10px] sm:[&_span]:text-[11px]"
              />
            </CompactFormField>
          </div>
        </div>

        <div className="wizard-compact rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <CompactFormField label="Oportunidad" className="wizard-inline-field flex-1 min-w-0">
            <CompactOportunidadSelector
              value={values.oportunidadId}
              onChange={(value) =>
                setValues((prev) => ({ ...prev, oportunidadId: value }))
              }
              placeholder="Selecciona oportunidad"
              className="h-7 w-full px-2 text-[10px] sm:h-7 sm:px-2 sm:text-[11px] md:h-7 md:text-[11px] [&_span]:text-[10px] sm:[&_span]:text-[11px] md:[&_span]:text-[11px]"
              popoverClassName="w-80 max-w-lg text-[10px] sm:text-[11px] [&_*]:text-[10px] sm:[&_*]:text-[11px]"
              filter={{ activo: true }}
              dependsOn="activo-true"
              clearable
              showWideDropdown={false}
            />
          </CompactFormField>
        </div>
      </CompactFormGrid>

      <div className="space-y-1">
        <CompactFormField label="Articulo default" required>
          <CompactComboboxQuery
            {...ARTICULOS_REFERENCE}
            value={values.articuloId}
            onChange={(value) =>
              setValues((prev) => ({ ...prev, articuloId: value }))
            }
            placeholder="Selecciona articulo"
            filter={articuloFilterQuery}
            dependsOn={articuloFilterId ?? "all"}
            clearable
          />
        </CompactFormField>

        <div className="wizard-compact rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <CompactFormGrid columns="three" className="gap-2 sm:gap-3">
            <CompactFormField label="Cantidad">
              <Input
                type="number"
                step="0.01"
                min="0"
                className="h-6 px-2 text-[9px] sm:h-7 sm:px-2.5 sm:text-[10px]"
                value={values.cantidad}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, cantidad: event.target.value }))
                }
              />
            </CompactFormField>

            <CompactFormField label="Precio unitario">
              <Input
                type="number"
                step="0.01"
                min="0"
                className="h-6 px-2 text-[9px] sm:h-7 sm:px-2.5 sm:text-[10px]"
                value={values.precio}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, precio: event.target.value }))
                }
              />
            </CompactFormField>

            <CompactFormField label="Importe">
              <div className="h-6 rounded-md border border-input bg-muted/50 px-2 text-[9px] leading-6 text-muted-foreground sm:h-7 sm:px-2.5 sm:text-[10px]">
                {importe.toFixed(2)}
              </div>
            </CompactFormField>
          </CompactFormGrid>
          <CompactFormField label="" className="space-y-0 mt-1">
            <Textarea
              rows={2}
              placeholder="Descripcion"
              className="min-h-8 px-2 py-1 text-[8px] sm:min-h-10 sm:px-2.5 sm:py-1.5 sm:text-[9px]"
              value={values.descripcion}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, descripcion: event.target.value }))
              }
            />
          </CompactFormField>
        </div>
      </div>
    </FormDialog>
  );
};

export { CreateWizardComponent as create_wizard };
