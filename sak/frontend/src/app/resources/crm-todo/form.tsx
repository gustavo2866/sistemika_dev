"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import type { Identity } from "ra-core";
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
import { UserSelector } from "@/components/forms";
import { CRM_EVENTO_TIPO_CHOICES } from "../crm-eventos/model";
import type { CRMEvento } from "../crm-eventos/model";

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
  records: CRMEvento[];
  identity?: Identity | null;
};

export type CRMEventoTodoFormDialogHandle = {
  open: (evento: CRMEvento) => void;
};

export const CRMEventoTodoFormDialog = forwardRef<CRMEventoTodoFormDialogHandle, CRMEventoTodoFormDialogProps>((
  { records, identity },
  ref
) => {
  const [isOpen, setIsOpen] = useState(false);
  const [evento, setEvento] = useState<CRMEvento | null>(null);
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [saving, setSaving] = useState(false);

  useImperativeHandle(ref, () => ({
    open: (selectedEvento: CRMEvento) => {
      setEvento(selectedEvento);
      setIsOpen(true);
    },
  }));

  const handleClose = () => {
    setIsOpen(false);
    setEvento(null);
  };

  const form = useForm<CRMEventoTodoFormValues>({
    defaultValues: buildDefaults(evento),
  });

  useEffect(() => {
    form.reset(buildDefaults(evento));
  }, [evento, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!evento?.id) return;

    const parsedDate = new Date(values.fecha_evento);
    if (Number.isNaN(parsedDate.getTime())) {
      notify("La fecha seleccionada no es válida", { type: "warning" });
      return;
    }

    setSaving(true);
    try {
      const payload = mapFormValuesToPayload(values, evento);
      await dataProvider.update<CRMEvento>("crm/eventos", {
        id: evento.id,
        data: payload,
        previousData: evento,
      });
      notify("Evento actualizado correctamente", { type: "success" });
      refresh();
      handleClose();
    } catch (err: any) {
      console.error("Error al actualizar evento:", err);
      notify(err?.message ?? "No se pudo actualizar el evento", { type: "error" });
    } finally {
      setSaving(false);
    }
  });

  return (
    <FormDialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
      title="Editar evento"
      description={
        evento ? `Actualiza los datos de ${evento.titulo ?? "este evento"}` : "Selecciona un evento para editarlo"
      }
      onSubmit={handleSubmit}
      onCancel={handleClose}
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
              <UserSelector
                records={records}
                identity={identity}
                ensureRecord={evento}
                variant="form"
                value={field.value}
                onValueChange={field.onChange}
                placeholder="Seleccionar usuario"
              />
            )}
          />
        </div>
      </div>
    </FormDialog>
  );
});

CRMEventoTodoFormDialog.displayName = "CRMEventoTodoFormDialog";

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

export { ensureOwnerOption, normalizeFormOwnerOptions } from "@/components/kanban/crm-owner-options";
