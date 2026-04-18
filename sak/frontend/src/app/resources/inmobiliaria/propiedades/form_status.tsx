"use client";

import { useEffect, useMemo } from "react";
import { useGetList, useGetOne } from "ra-core";
import { FormProvider, useForm } from "react-hook-form";
import { SectionBaseTemplate, FormDate, FormTextarea, FormValue } from "@/components/forms/form_order";
import { FormDialog } from "@/components/forms/form-dialog";

import type { Propiedad } from "./model";
import { PROPIEDAD_DIALOG_OVERLAY_CLASS } from "./dialog_styles";
import { isTipoOperacionAlquiler } from "./model";
import { PROPIEDAD_STATUS_IDS, getPropiedadStatusLabel } from "./status_transitions";
import { usePropiedadStatusTransition } from "./form_hooks";

type FormStatusProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: Propiedad;
  nextStatusId: number;
};

export type FormStatusValues = {
  fecha_cambio: string;
  comentario: string;
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-AR");
};

export const getStatusRestriction = ({
  isAlquiler,
  record,
  nextStatusId,
}: {
  isAlquiler: boolean;
  record: Propiedad;
  nextStatusId: number;
}) => {
  if (!isAlquiler) return null;

  if (nextStatusId === PROPIEDAD_STATUS_IDS.realizada) {
    return "Solo se puede pasar a Realizada poniendo en vigencia un contrato de alquiler.";
  }

  if (
    record.propiedad_status_id === PROPIEDAD_STATUS_IDS.realizada &&
    nextStatusId === PROPIEDAD_STATUS_IDS.recibida
  ) {
    return "Solo se puede cambiar a este estado finalizando o rescindiendo el contrato de alquiler vigente.";
  }

  return null;
};

export const FormStatusContent = ({
  record,
  nextStatusId,
}: {
  record: Propiedad;
  nextStatusId: number;
}) => {
  const tipoOperacionId = record.tipo_operacion_id ?? null;
  const { data: tipoOperacion } = useGetOne(
    "crm/catalogos/tipos-operacion",
    { id: tipoOperacionId ?? 0 },
    {
      enabled:
        Boolean(tipoOperacionId) &&
        !record.tipo_operacion?.nombre &&
        !("codigo" in (record.tipo_operacion ?? {})),
    },
  );
  const tipoOperacionRef =
    record.tipo_operacion ??
    ((tipoOperacion as { nombre?: string | null; codigo?: string | null } | undefined) ?? null);
  const isAlquiler = isTipoOperacionAlquiler(tipoOperacionRef ?? undefined);
  const restrictionMessage = getStatusRestriction({ isAlquiler, record, nextStatusId });
  const shouldShowContratoVigente =
    isAlquiler &&
    record.propiedad_status_id === PROPIEDAD_STATUS_IDS.realizada &&
    nextStatusId === PROPIEDAD_STATUS_IDS.recibida;
  const { data: contratosVigentes = [] } = useGetList<any>(
    "contratos",
    {
      filter: {
        propiedad_id: record.id,
        estado: "vigente",
      },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "DESC" },
    },
    { enabled: shouldShowContratoVigente && Boolean(record.id) },
  );
  const contratoVigente = contratosVigentes[0];
  const estadoActualLabel = getPropiedadStatusLabel(record.propiedad_status_id ?? null);
  const estadoNuevoLabel = getPropiedadStatusLabel(nextStatusId);

  return (
    <div className="w-full max-w-[400px] mx-auto space-y-3">
      <SectionBaseTemplate
        title="Resumen"
        defaultOpen
        main={
          <div className="grid gap-2 md:grid-cols-2">
            <FormValue label="Propiedad" widthClass="w-full" valueClassName="justify-start text-left">
              {record.nombre}
            </FormValue>
            <FormValue label="ID" widthClass="w-full sm:w-[140px]">
              #{record.id}
            </FormValue>
            <FormValue label="Estado actual" widthClass="w-full" valueClassName="justify-start text-left">
              {estadoActualLabel}
            </FormValue>
            <FormValue label="Fecha estado" widthClass="w-full sm:w-[140px]">
              {formatDateLabel(record.estado_fecha)}
            </FormValue>
          </div>
        }
      />
      <SectionBaseTemplate
        title="Cambio"
        defaultOpen
        main={
          <div className="grid gap-2">
            <div className="grid gap-2 md:grid-cols-2">
              <FormValue
                label="Nuevo estado"
                widthClass="w-full"
                valueClassName="justify-start text-left bg-emerald-50 text-emerald-700 border-emerald-200"
              >
                {estadoNuevoLabel}
              </FormValue>
              <FormDate
                source="fecha_cambio"
                label="Fecha del cambio"
                widthClass="w-full sm:w-[140px]"
              />
              <FormTextarea
                source="comentario"
                label="Comentario (recomendado)"
                widthClass="w-full sm:w-[320px]"
                className="[&_textarea]:min-h-[64px]"
                maxLength={500}
                placeholder="Detalle del cambio de estado"
              />
            </div>
            {restrictionMessage ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {restrictionMessage}
              </div>
            ) : null}
            {shouldShowContratoVigente ? (
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Contrato vigente
                </div>
                <div className="grid gap-1 md:grid-cols-2">
                  <div>ID: {contratoVigente?.id ? `#${contratoVigente.id}` : "No encontrado"}</div>
                  <div>Estado: {contratoVigente?.estado ?? "-"}</div>
                  <div>
                    Inquilino: {[contratoVigente?.inquilino_nombre, contratoVigente?.inquilino_apellido].filter(Boolean).join(" ") || "-"}
                  </div>
                  <div>Inicio: {formatDateLabel(contratoVigente?.fecha_inicio)}</div>
                  <div>Finalizacion: {formatDateLabel(contratoVigente?.fecha_vencimiento)}</div>
                </div>
              </div>
            ) : null}
          </div>
        }
      />
    </div>
  );
};

export const FormStatus = ({ open, onOpenChange, record, nextStatusId }: FormStatusProps) => {
  const { cambiarEstado, loading } = usePropiedadStatusTransition();
  const tipoOperacionId = record.tipo_operacion_id ?? null;
  const { data: tipoOperacion } = useGetOne(
    "crm/catalogos/tipos-operacion",
    { id: tipoOperacionId ?? 0 },
    {
      enabled:
        Boolean(tipoOperacionId) &&
        !record.tipo_operacion?.nombre &&
        !("codigo" in (record.tipo_operacion ?? {})),
    },
  );
  const tipoOperacionRef =
    record.tipo_operacion ??
    ((tipoOperacion as { nombre?: string | null; codigo?: string | null } | undefined) ?? null);
  const isAlquiler = isTipoOperacionAlquiler(tipoOperacionRef ?? undefined);
  const restrictionMessage = getStatusRestriction({ isAlquiler, record, nextStatusId });

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const form = useForm<FormStatusValues>({
    defaultValues: { fecha_cambio: today, comentario: "" },
    mode: "onChange",
  });

  useEffect(() => {
    if (open) {
      form.reset({ fecha_cambio: today, comentario: "" });
    }
  }, [open, form, today]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const ok = await cambiarEstado({
      record,
      nextStatusId,
      fechaCambio: values.fecha_cambio,
      comentario: values.comentario,
    });
    if (ok) onOpenChange(false);
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => (!loading ? onOpenChange(nextOpen) : null)}
      title="Cambiar estado"
      onSubmit={handleSubmit}
      onCancel={() => onOpenChange(false)}
      submitLabel="Confirmar"
      isSubmitting={loading}
      submitDisabled={!form.watch("fecha_cambio") || Boolean(restrictionMessage)}
      contentClassName="sm:max-w-[420px]"
      overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
      compact
    >
      <FormProvider {...form}>
        <FormStatusContent record={record} nextStatusId={nextStatusId} />
      </FormProvider>
    </FormDialog>
  );
};
