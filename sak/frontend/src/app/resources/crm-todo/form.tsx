"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRM_EVENTO_TIPO_CHOICES } from "../crm-eventos/model";
import type { CRMEvento } from "../crm-eventos/model";

export type OwnerOption = { value: string; label: string };

export type CRMEventoTodoFormValues = {
  fecha_evento: string;
  tipo_evento: string;
  titulo: string;
  descripcion: string;
  asignado_a_id: string;
};

const toDateTimeLocalValue = (date?: Date) => {
  const value = date ?? new Date();
  const tzOffset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - tzOffset).toISOString().slice(0, 16);
};

const buildDefaults = (evento: CRMEvento | null): CRMEventoTodoFormValues => ({
  fecha_evento: evento?.fecha_evento ? toDateTimeLocalValue(new Date(evento.fecha_evento)) : toDateTimeLocalValue(),
  tipo_evento: evento?.tipo_evento ?? "",
  titulo: evento?.titulo ?? "",
  descripcion: evento?.descripcion ?? "",
  asignado_a_id: evento?.asignado_a?.id
    ? String(evento.asignado_a.id)
    : evento?.asignado_a_id
      ? String(evento.asignado_a_id)
      : "0",
});

type CRMEventoTodoFormDialogProps = {
  open: boolean;
  evento: CRMEvento | null;
  ownerOptions: OwnerOption[];
  onClose: () => void;
  onSubmit: (values: CRMEventoTodoFormValues) => Promise<void> | void;
  saving: boolean;
};

export const CRMEventoTodoFormDialog = ({
  open,
  evento,
  ownerOptions,
  onClose,
  onSubmit,
  saving,
}: CRMEventoTodoFormDialogProps) => {
  const form = useForm<CRMEventoTodoFormValues>({
    defaultValues: buildDefaults(evento),
  });

  useEffect(() => {
    form.reset(buildDefaults(evento));
  }, [evento, form]);

  const sortedOwnerOptions = useMemo(() => ownerOptions, [ownerOptions]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Editar evento"
      description={
        evento ? `Actualiza los datos de ${evento.titulo ?? "este evento"}` : "Selecciona un evento para editarlo"
      }
      onSubmit={handleSubmit}
      onCancel={onClose}
      isSubmitting={saving}
      submitLabel="Guardar"
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-500">Fecha y hora</span>
          <Input
            type="datetime-local"
            {...form.register("fecha_evento", { required: true })}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-500">Tipo de evento</span>
          <Controller
            control={form.control}
            name="tipo_evento"
            rules={{ required: true }}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="rounded-2xl border-slate-200/80 bg-white">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {CRM_EVENTO_TIPO_CHOICES.map((choice) => (
                    <SelectItem key={choice.id} value={choice.id}>
                      {choice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-500">Título</span>
          <Input {...form.register("titulo", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-500">Descripción</span>
          <Textarea rows={3} {...form.register("descripcion")} />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-500">Asignado</span>
          <Controller
            control={form.control}
            name="asignado_a_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="rounded-2xl border-slate-200/80 bg-white">
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  {sortedOwnerOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
    </FormDialog>
  );
};

export const mapFormValuesToPayload = (
  values: CRMEventoTodoFormValues,
  fallback: CRMEvento
) => {
  const parsedDate = new Date(values.fecha_evento);
  return {
    fecha_evento: Number.isNaN(parsedDate.getTime()) ? fallback.fecha_evento : parsedDate.toISOString(),
    tipo_evento: values.tipo_evento || fallback.tipo_evento,
    titulo: values.titulo.trim() || fallback.titulo,
    descripcion: values.descripcion ?? fallback.descripcion ?? "",
    asignado_a_id: values.asignado_a_id === "0" ? null : Number(values.asignado_a_id),
  };
};

export const ensureOwnerOption = (
  options: OwnerOption[],
  evento: CRMEvento | null
): OwnerOption[] => {
  if (!evento) return options;
  const ownerId = evento.asignado_a?.id ?? evento.asignado_a_id;
  if (!ownerId) return options;
  const hasOwner = options.some((option) => option.value === String(ownerId));
  if (hasOwner) return options;
  return [...options, { value: String(ownerId), label: evento.asignado_a?.nombre ?? `Usuario #${ownerId}` }];
};

export const normalizeFormOwnerOptions = (options: OwnerOption[]): OwnerOption[] => {
  const unique = new Map<string, OwnerOption>();
  unique.set("0", { value: "0", label: "Sin asignar" });
  options.forEach((option) => {
    if (!unique.has(option.value)) {
      unique.set(option.value, option);
    }
  });
  return Array.from(unique.values());
};
