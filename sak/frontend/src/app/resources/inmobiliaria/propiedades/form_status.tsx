"use client";

import { useEffect, useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { SectionBaseTemplate, FormDate, FormTextarea, FormValue } from "@/components/forms/form_order";
import { FormDialog } from "@/components/forms/form-dialog";

import type { Propiedad } from "./model";
import { getPropiedadStatusLabel } from "./status_transitions";
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

export const FormStatusContent = ({
  record,
  nextStatusId,
}: {
  record: Propiedad;
  nextStatusId: number;
}) => {
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
        }
      />
    </div>
  );
};

export const FormStatus = ({ open, onOpenChange, record, nextStatusId }: FormStatusProps) => {
  const { cambiarEstado, loading } = usePropiedadStatusTransition();

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
      submitDisabled={!form.watch("fecha_cambio")}
      contentClassName="sm:max-w-[420px]"
      compact
    >
      <FormProvider {...form}>
        <FormStatusContent record={record} nextStatusId={nextStatusId} />
      </FormProvider>
    </FormDialog>
  );
};
