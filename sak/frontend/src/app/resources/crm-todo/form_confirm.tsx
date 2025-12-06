"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { FormDialog } from "@/components/forms/form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CRMEvento } from "../crm-eventos/model";
import {
  CRM_OPORTUNIDAD_ESTADO_CHOICES,
  type CRMOportunidadEstado,
} from "../crm-oportunidades/model";
import { cn } from "@/lib/utils";
import { ChevronRight, UserRound } from "lucide-react";

const TRANSICIONES_ESTADO_OPORTUNIDAD: Record<string, CRMOportunidadEstado[]> = {
  "0-prospect": ["1-abierta", "6-perdida"],
  "1-abierta": ["2-visita", "3-cotiza", "6-perdida"],
  "2-visita": ["3-cotiza", "6-perdida"],
  "3-cotiza": ["4-reserva", "5-ganada", "6-perdida"],
  "4-reserva": ["5-ganada", "6-perdida"],
  "5-ganada": ["1-abierta"],
  "6-perdida": ["1-abierta"],
};

const formatDateTime = (value?: string) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
};

const getOportunidadName = (evento: CRMEvento | null) => {
  if (!evento) return "Sin oportunidad";
  const titulo = evento.oportunidad?.titulo || "";
  if (evento.oportunidad_id) {
    return `#${evento.oportunidad_id}${titulo ? ` ${titulo}` : ""}`.trim();
  }
  return titulo || "Sin oportunidad";
};

const getContactoName = (evento: CRMEvento | null) => {
  if (!evento) return "Sin contacto";
  const contacto = evento.oportunidad?.contacto;
  const contactoNombreManual = (evento.oportunidad as { contacto_nombre?: string } | undefined)?.contacto_nombre?.trim();
  const nombre =
    contacto?.nombre?.trim() ||
    contacto?.nombre_completo?.trim() ||
    contactoNombreManual;
  if (nombre) {
    return nombre;
  }
  const contactoId = evento.oportunidad?.contacto_id;
  return contactoId ? `Contacto #${contactoId}` : "Sin contacto";
};

const getEventoTitulo = (evento: CRMEvento | null) => {
  if (!evento) return "Sin título";
  const titulo = evento.titulo?.trim() ?? "";
  if (!titulo) return "Sin título";
  return titulo.replace(/^ATRASADO:\s*/i, "") || "Sin título";
};

type CRMEventoConfirmFormValues = {
  resultado: string;
  oportunidad_estado: string;
};

type CRMEventoConfirmDialogProps = {
  open: boolean;
  evento: CRMEvento | null;
  onClose: () => void;
  onSubmit: (values: CRMEventoConfirmFormValues) => Promise<void> | void;
  saving: boolean;
};

const getAvailableEstadoOptions = (evento: CRMEvento | null) => {
  const current = (evento?.oportunidad?.estado as CRMOportunidadEstado | undefined) ?? "";
  if (!current) return [];
  const allowedTargets = TRANSICIONES_ESTADO_OPORTUNIDAD[current] ?? [];
  const unique = new Set<string>([current, ...allowedTargets]);
  return CRM_OPORTUNIDAD_ESTADO_CHOICES.filter((choice) => unique.has(choice.id));
};

export const CRMEventoConfirmFormDialog = ({
  open,
  evento,
  onClose,
  onSubmit,
  saving,
}: CRMEventoConfirmDialogProps) => {
  const form = useForm<CRMEventoConfirmFormValues>({
    defaultValues: {
      resultado: "",
      oportunidad_estado: (evento?.oportunidad?.estado as CRMOportunidadEstado | undefined) ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      resultado: "",
      oportunidad_estado: (evento?.oportunidad?.estado as CRMOportunidadEstado | undefined) ?? "",
    });
  }, [evento, form]);

  const estadoOptions = useMemo(() => getAvailableEstadoOptions(evento), [evento]);
  const oportunidadDisponible = Boolean(evento?.oportunidad_id && estadoOptions.length > 0);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  const fechaEvento = formatDateTime(evento?.fecha_evento);

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Confirmar evento"
      description="Registra el resultado y actualiza el estado de la oportunidad si corresponde."
      onSubmit={handleSubmit}
      onCancel={onClose}
      isSubmitting={saving}
      submitLabel="Confirmar"
    >
      <div className="space-y-4">
        <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-3 py-3">
          <InfoRow label="Fecha y hora" value={fechaEvento} />
          <InfoRow label="Título" value={getEventoTitulo(evento)} />
          <InfoRow label="Descripción" value={evento?.descripcion ?? "Sin descripción"} multiline />
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-500">Resultado</span>
          <Textarea
            placeholder="Describe el resultado de este evento"
            rows={3}
            className="rounded-2xl border-slate-200/80 h-24 resize-none overflow-y-auto"
            {...form.register("resultado", { required: true })}
          />
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-inner">
          <div className="space-y-2">
            <InfoRow
              label="Oportunidad"
              value={
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                  <span className="truncate">{getOportunidadName(evento)}</span>
                </div>
              }
              isCustom
            />
            <InfoRow
              label="Contacto"
              value={
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <UserRound className="h-3 w-3 text-slate-400" />
                  <span className="truncate">{getContactoName(evento)}</span>
                </div>
              }
              isCustom
            />
            {oportunidadDisponible ? (
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase text-slate-500">Estado de la oportunidad</span>
                <Controller
                  control={form.control}
                  name="oportunidad_estado"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-2xl border-slate-200/80 bg-white">
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {estadoOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                No hay una oportunidad asociada o no existen transiciones válidas disponibles.
              </div>
            )}
          </div>
        </div>
      </div>
    </FormDialog>
  );
};

const InfoRow = ({
  label,
  value,
  multiline,
  isCustom,
}: {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
  isCustom?: boolean;
}) => (
  <div className={cn("space-y-0.5", multiline ? "flex flex-col" : "")}>
    <span className="text-[11px] font-semibold uppercase text-slate-500">{label}</span>
    {isCustom ? (
      <div className="rounded-xl bg-white/70 px-3 py-1.5 border border-slate-100">{value}</div>
    ) : (
      <p
        className={cn(
          "text-sm text-slate-800 rounded-xl bg-white/70 px-3 py-1.5 border border-slate-100",
          multiline ? "max-h-16 overflow-y-auto whitespace-pre-line" : ""
        )}
      >
        {typeof value === "string" ? value || "—" : value}
      </p>
    )}
  </div>
);

export type { CRMEventoConfirmFormValues };
