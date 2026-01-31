"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FormDialog } from "@/components/forms";
import { CompactComboboxQuery, CompactFormField, CompactFormGrid } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/forms/combobox";
import { Button } from "@/components/ui/button";
import { useDataProvider, useGetOne } from "ra-core";
import { CompactOportunidadSelector } from "../../crm-oportunidades";
import { useForm } from "react-hook-form";
import {
  ARTICULOS_REFERENCE,
  CENTROS_COSTO_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  PROVEEDORES_REFERENCE,
  TIPO_COMPRA_CHOICES,
  TIPOS_SOLICITUD_REFERENCE,
} from "./model";
import { getArticuloFilterByTipo, normalizeId, normalizeNumber } from "../shared/po-utils";
import type { TipoSolicitud } from "../../tipos-solicitud/model";

type WizardValues = {
  proveedorId: string;
  tipoSolicitudId: string;
  departamentoId: string;
  tipoCompra: string;
  articuloId: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  centroCostoId: string;
  oportunidadId: string;
  cantidad: string;
  precio: string;
};

export type CreateWizardPayload = {
  proveedorId: number | null;
  tipoSolicitudId: number | null;
  departamentoId: number | null;
  tipoCompra: string | null;
  articuloId: number | null;
  titulo: string;
  descripcion: string;
  fecha: string | null;
  centroCostoId: number | null;
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
  fecha: "",
  centroCostoId: "",
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
  const dataProvider = useDataProvider();
  const form = useForm<WizardValues>({ defaultValues });
  const { register, setValue, reset, watch, trigger, formState, handleSubmit } = form;
  const values = watch();
  const [step, setStep] = useState<1 | 2>(1);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const prevCentroRef = useRef(values.centroCostoId);
  const prevOportunidadRef = useRef(values.oportunidadId);
  const allowCloseRef = useRef(false);

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
      reset(defaultValues);
      setStep(1);
      return;
    }
    reset({ ...defaultValues, fecha: today });
  }, [open, reset, today]);

  useEffect(() => {
    if (!proveedorData) return;
    setValue(
      "tipoSolicitudId",
      toWizardValue((proveedorData as any)?.default_tipo_solicitud_id),
      { shouldDirty: true }
    );
    setValue(
      "departamentoId",
      toWizardValue((proveedorData as any)?.default_departamento_id),
      { shouldDirty: true }
    );
    setValue(
      "articuloId",
      toWizardValue((proveedorData as any)?.default_articulos_id),
      { shouldDirty: true }
    );
  }, [proveedorData, setValue]);

  useEffect(() => {
    const prevCentro = prevCentroRef.current;
    if (
      values.centroCostoId &&
      values.centroCostoId !== prevCentro &&
      values.oportunidadId
    ) {
      setValue("oportunidadId", "", { shouldDirty: true });
    }
    prevCentroRef.current = values.centroCostoId;
  }, [setValue, values.centroCostoId, values.oportunidadId]);

  useEffect(() => {
    const prevOportunidad = prevOportunidadRef.current;
    if (
      values.oportunidadId &&
      values.oportunidadId !== prevOportunidad &&
      values.centroCostoId
    ) {
      setValue("centroCostoId", "", { shouldDirty: true });
    }
    prevOportunidadRef.current = values.oportunidadId;
  }, [setValue, values.centroCostoId, values.oportunidadId]);

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

  const handleApply = (data: WizardValues) => {
    const payload: CreateWizardPayload = {
      proveedorId: normalizeId(data.proveedorId),
      tipoSolicitudId: normalizeId(data.tipoSolicitudId),
      departamentoId: normalizeId(data.departamentoId),
      tipoCompra: data.tipoCompra || null,
      articuloId: normalizeId(data.articuloId),
      titulo: data.titulo,
      descripcion: data.descripcion,
      fecha: data.fecha || null,
      centroCostoId: normalizeId(data.centroCostoId),
      oportunidadId: normalizeId(data.oportunidadId),
      cantidad: normalizeNumber(data.cantidad),
      precio: normalizeNumber(data.precio),
      unidadMedida,
    };
    onApply(payload);
    allowCloseRef.current = true;
    onOpenChange(false);
    allowCloseRef.current = false;
  };

  const handleNext = async () => {
    const isValid = await trigger(["titulo", "fecha"]);
    if (isValid) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 1) {
      handleNext();
      return;
    }
    handleSubmit(handleApply)(event);
  };

  const handleCancel = () => {
    allowCloseRef.current = true;
    onOpenChange(false);
    allowCloseRef.current = false;
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !allowCloseRef.current) {
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Asistente de creación"
      description="Completa los datos minimos para generar una orden de compra."
      contentClassName="sm:max-w-5xl"
      compact={false}
      onSubmit={handleFormSubmit}
      onCancel={handleCancel}
      submitLabel="Aplicar"
      showFooter={false}
    >
      {step === 1 ? (
        <CompactFormGrid columns="one" className="gap-0.5 sm:gap-1">
          <div className="grid grid-cols-[1fr_140px] items-start gap-2 sm:gap-3">
          <CompactFormField
            label="Titulo"
            required
            error={formState.errors.titulo}
            labelClassName="!text-[11px] leading-none sm:!text-sm"
          >
            <Input
              className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
              {...register("titulo", { required: "El titulo es obligatorio" })}
            />
          </CompactFormField>
          <CompactFormField
            label="Fecha Nec"
            required
            error={formState.errors.fecha}
            className="wizard-inline-field w-full max-w-[130px]"
            labelClassName="!text-[11px] leading-none sm:!text-sm"
          >
            <Input
              type="date"
              className="h-7 px-2 text-[10px] sm:h-7 sm:px-2 sm:text-[11px] md:h-7 md:text-[11px]"
              {...register("fecha", { required: "La fecha es obligatoria" })}
            />
          </CompactFormField>
          </div>

          <div className="wizard-compact rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 sm:gap-3">
              <CompactFormField label="Centro de costo" className="wizard-inline-field min-w-0">
                <CompactComboboxQuery
                  {...CENTROS_COSTO_REFERENCE}
                  value={values.centroCostoId}
                  onChange={(value) =>
                    setValue("centroCostoId", value, { shouldDirty: true })
                  }
                  placeholder="Centro"
                  clearable
                  filter={CENTROS_COSTO_REFERENCE.filter}
                  className="h-7 w-full px-2 text-[9px] sm:h-7 sm:px-2 sm:text-[10px] md:h-7 md:text-[10px] [&_span]:text-[9px] sm:[&_span]:text-[10px] md:[&_span]:text-[10px]"
                  popoverClassName="w-72 max-w-sm text-[9px] sm:text-[10px] [&_*]:text-[9px] sm:[&_*]:text-[10px]"
                  clearButtonClassName="ml-0.5 -mr-2 h-[0.7rem] w-[0.7rem] p-0 [&_svg]:!h-[0.65rem] [&_svg]:!w-[0.65rem]"
                  clearIconClassName="!h-[0.65rem] !w-[0.65rem]"
                />
              </CompactFormField>
              <CompactFormField label="Oportunidad" className="wizard-inline-field flex-1 min-w-0">
                <CompactOportunidadSelector
                  value={values.oportunidadId}
                  onChange={(value) =>
                    setValue("oportunidadId", value, { shouldDirty: true })
                  }
                  placeholder="Selecciona oportunidad"
                  className="h-7 w-full px-2 text-[9px] sm:h-7 sm:px-2 sm:text-[10px] md:h-7 md:text-[10px] [&_span]:text-[9px] sm:[&_span]:text-[10px] md:[&_span]:text-[10px]"
                  popoverClassName="w-64 max-w-xs text-[9px] sm:text-[10px] [&_*]:text-[9px] sm:[&_*]:text-[10px]"
                  filter={{ activo: true }}
                  dependsOn="activo-true"
                  clearable
                  showWideDropdown={false}
                  clearButtonClassName="ml-0.5 -mr-2 h-[0.7rem] w-[0.7rem] p-0 [&_svg]:!h-[0.65rem] [&_svg]:!w-[0.65rem]"
                  clearIconClassName="!h-[0.65rem] !w-[0.65rem]"
                />
              </CompactFormField>
            </div>
          </div>

          <CompactFormField label="Proveedor" className="mt-3">
            <CompactComboboxQuery
              {...PROVEEDORES_REFERENCE}
              value={values.proveedorId}
              onChange={(value) =>
                setValue("proveedorId", value, { shouldDirty: true })
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
                    setValue("tipoSolicitudId", value, { shouldDirty: true })
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
                    setValue("departamentoId", value, { shouldDirty: true })
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
                  setValue("tipoCompra", value, { shouldDirty: true })
                }
                  placeholder="Selecciona tipo"
                  className="h-7 w-full px-2 text-[10px] sm:h-8 sm:px-3 sm:text-[11px] [&_span]:text-[10px] sm:[&_span]:text-[11px]"
                />
              </CompactFormField>
            </div>
          </div>
        </CompactFormGrid>
      ) : (
        <div className="space-y-1">
          <CompactFormField label="Articulo default" required>
            <CompactComboboxQuery
              {...ARTICULOS_REFERENCE}
              value={values.articuloId}
              onChange={(value) =>
                setValue("articuloId", value, { shouldDirty: true })
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
                {...register("cantidad")}
              />
              </CompactFormField>

              <CompactFormField label="Precio unitario">
              <Input
                type="number"
                step="0.01"
                min="0"
                className="h-6 px-2 text-[9px] sm:h-7 sm:px-2.5 sm:text-[10px]"
                {...register("precio")}
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
              {...register("descripcion")}
            />
            </CompactFormField>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {step === 2 ? (
          <Button type="button" variant="ghost" onClick={handleBack} className="w-full sm:w-auto">
            Anterior
          </Button>
        ) : null}
        {step === 1 ? (
          <Button type="button" onClick={handleNext} className="w-full sm:w-auto">
            Siguiente
          </Button>
        ) : (
          <Button type="submit" className="w-full sm:w-auto">
            Aplicar
          </Button>
        )}
      </div>
    </FormDialog>
  );
};

export { CreateWizardComponent as create_wizard };
