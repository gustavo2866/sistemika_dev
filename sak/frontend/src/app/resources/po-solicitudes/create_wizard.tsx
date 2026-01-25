"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FormDialog } from "@/components/forms";
import { CompactComboboxQuery, CompactFormField, CompactFormGrid } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/forms/combobox";
import { useDataProvider, useGetOne } from "ra-core";
import { CompactOportunidadSelector } from "../crm-oportunidades";
import {
  ARTICULOS_REFERENCE,
  PROVEEDORES_REFERENCE,
  TIPO_COMPRA_CHOICES,
  getArticuloFilterByTipo,
} from "./model";
import type { TipoSolicitud } from "../tipos-solicitud/model";
import {
  DEPARTAMENTOS_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
} from "../proveedores/model";

type WizardValues = {
  proveedorId: string;
  tipoSolicitudId: string;
  departamentoId: string;
  tipoCompra: string;
  articuloId: string;
  titulo: string;
  descripcion: string;
  fechaNecesidad: string;
  oportunidadId: string;
  cantidad: string;
  precio: string;
};

type WizardErrors = {
  titulo?: string;
  fechaNecesidad?: string;
};

export type CreateWizardPayload = {
  proveedorId: number | null;
  tipoSolicitudId: number | null;
  departamentoId: number | null;
  tipoCompra: string | null;
  articuloId: number | null;
  titulo: string;
  descripcion: string;
  fechaNecesidad: string | null;
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
  articuloId: "",
  titulo: "",
  descripcion: "",
  fechaNecesidad: "",
  oportunidadId: "",
  cantidad: "1",
  precio: "",
};

const normalizeId = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeNumber = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toWizardValue = (value?: number | null) =>
  value && Number.isFinite(value) ? String(value) : "";

const WizardFieldLabel = ({ label }: { label: string }) => (
  <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
    {label}
  </span>
);

const CreateWizardComponent = ({
  open,
  onOpenChange,
  onApply,
  lockedOportunidadId,
  oportunidadFilter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (payload: CreateWizardPayload) => void;
  lockedOportunidadId?: number;
  oportunidadFilter?: Record<string, unknown>;
}) => {
  const [values, setValues] = useState<WizardValues>(defaultValues);
  const dataProvider = useDataProvider();
  const [errors, setErrors] = useState<WizardErrors>({});
  const tomorrow = useMemo(() => {
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    return next.toISOString().slice(0, 10);
  }, []);

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

  const isGenerico = Boolean((articuloData as { generico?: boolean } | undefined)?.generico);
  const unidadMedida =
    (articuloData as { unidad_medida?: string } | undefined)?.unidad_medida ?? null;
  const shouldLockOportunidad =
    typeof lockedOportunidadId === "number" && Number.isFinite(lockedOportunidadId);
  useGetOne(
    "crm/oportunidades",
    { id: lockedOportunidadId ?? 0 },
    { enabled: Boolean(shouldLockOportunidad) },
  );
  useEffect(() => {
    if (!open) return;
    console.log(
      "[po-solicitudes/wizard] open",
      open,
      "lockedOportunidadId",
      lockedOportunidadId,
      "shouldLock",
      shouldLockOportunidad,
    );
  }, [lockedOportunidadId, open, shouldLockOportunidad]);

  useEffect(() => {
    if (!open) {
      setValues(defaultValues);
      setErrors({});
      return;
    }
    setValues((prev) => ({
      ...prev,
      fechaNecesidad: prev.fechaNecesidad || tomorrow,
      oportunidadId: shouldLockOportunidad
        ? String(lockedOportunidadId ?? "")
        : prev.oportunidadId,
    }));
  }, [open, lockedOportunidadId, shouldLockOportunidad, tomorrow]);

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
    if (!values.titulo.trim()) {
      nextErrors.titulo = "El titulo es obligatorio";
    }
    if (!values.fechaNecesidad) {
      nextErrors.fechaNecesidad = "La fecha es obligatoria";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const resolvedOportunidadId = shouldLockOportunidad
      ? lockedOportunidadId ?? null
      : normalizeId(values.oportunidadId);
    const payload: CreateWizardPayload = {
      proveedorId: normalizeId(values.proveedorId),
      tipoSolicitudId: normalizeId(values.tipoSolicitudId),
      departamentoId: normalizeId(values.departamentoId),
      tipoCompra: values.tipoCompra || null,
      articuloId: normalizeId(values.articuloId),
      titulo: values.titulo,
      descripcion: values.descripcion,
      fechaNecesidad: values.fechaNecesidad || null,
      oportunidadId: resolvedOportunidadId,
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
      description="Completa los datos minimos para generar una solicitud."
      contentClassName="sm:max-w-5xl"
      compact={false}
      onSubmit={handleApply}
      onCancel={() => onOpenChange(false)}
      submitLabel="Aplicar"
    >
      <CompactFormGrid columns="one" className="gap-0.5 sm:gap-1">
        <CompactFormField label="Titulo" required error={errors.titulo}>
          <Input
            className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
            value={values.titulo}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, titulo: event.target.value }))
            }
            onBlur={() =>
              setErrors((prev) => ({ ...prev, titulo: undefined }))
            }
          />
        </CompactFormField>

        <div className="wizard-compact rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <div className="grid grid-cols-[140px_1fr] gap-2 sm:gap-3">
            <CompactFormField
              label="Fecha necesidad"
              required
              error={errors.fechaNecesidad}
              className="wizard-inline-field w-full max-w-[130px]"
            >
              <Input
                type="date"
                className="h-7 px-2 text-[10px] sm:h-7 sm:px-2 sm:text-[11px] md:h-7 md:text-[11px]"
                value={values.fechaNecesidad}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, fechaNecesidad: event.target.value }))
                }
                onBlur={() =>
                  setErrors((prev) => ({ ...prev, fechaNecesidad: undefined }))
                }
              />
            </CompactFormField>

            <CompactFormField label="Oportunidad" className="wizard-inline-field flex-1 min-w-0">
              <CompactOportunidadSelector
                value={
                  shouldLockOportunidad
                    ? String(lockedOportunidadId ?? "")
                    : values.oportunidadId
                }
                onChange={(value) =>
                  shouldLockOportunidad
                    ? undefined
                    : setValues((prev) => ({ ...prev, oportunidadId: value }))
                }
                placeholder="Selecciona oportunidad"
                className="h-7 w-full px-2 text-[10px] sm:h-7 sm:px-2 sm:text-[11px] md:h-7 md:text-[11px] [&_span]:text-[10px] sm:[&_span]:text-[11px] md:[&_span]:text-[11px]"
                popoverClassName="w-80 max-w-lg text-[10px] sm:text-[11px] [&_*]:text-[10px] sm:[&_*]:text-[11px]"
                filter={
                  shouldLockOportunidad
                    ? { id: lockedOportunidadId }
                    : oportunidadFilter
                }
                dependsOn={
                  shouldLockOportunidad
                    ? `locked-${lockedOportunidadId ?? "none"}`
                    : oportunidadFilter?.tipo_operacion_id ?? "all"
                }
                disabled={shouldLockOportunidad}
                clearable={!shouldLockOportunidad}
                showWideDropdown={false}
              />
            </CompactFormField>
        </div>
        </div>

        <CompactFormField label="Proveedor" className="mt-3">
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
            placeholder={isGenerico ? "Descripcion obligatoria" : "Descripcion"}
            className="min-h-8 px-2 py-1 text-[8px] sm:min-h-10 sm:px-2.5 sm:py-1.5 sm:text-[9px]"
            value={values.descripcion}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, descripcion: event.target.value }))
            }
          />
        </CompactFormField>
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <WizardFieldLabel label="Importe calculado" />
        <span>{importe.toFixed(2)}</span>
      </div>
    </FormDialog>
  );
};

export { CreateWizardComponent as create_wizard };
