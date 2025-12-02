"use client";

import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { required, useGetOne, useRecordContext } from "ra-core";

import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormLayout, FormSimpleSection } from "@/components/forms";
import { ActividadesPanel } from "../crm-actividades/Panel";
import type { CRMEvento } from "./model";
import { CRM_EVENTO_ESTADO_CHOICES, CRM_EVENTO_TIPO_CHOICES } from "./model";
import { ArrowRightLeft } from "lucide-react";

const ESTADO_BADGES: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  realizado: "bg-emerald-100 text-emerald-800",
  cancelado: "bg-red-100 text-red-800",
  reagendar: "bg-blue-100 text-blue-800",
};

const parseNumericId = (value?: unknown) => {
  if (value == null || value === "") return undefined;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : undefined;
};

const formatDateTime = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-AR", options ?? { dateStyle: "short", timeStyle: "short" });
};

const formatEstado = (value?: string | null) => {
  if (!value) return "Sin estado";
  const option = CRM_EVENTO_ESTADO_CHOICES.find((choice) => choice.id === value);
  return option?.name ?? value;
};

const estadoMap = new Map<string, string>([
  ["pendiente", "1-pendiente"],
  ["hecho", "2-realizado"],
  ["realizado", "2-realizado"],
  ["cancelado", "3-cancelado"],
  ["reagendar", "4-reagendar"],
  ["1-pendiente", "1-pendiente"],
  ["2-realizado", "2-realizado"],
  ["3-cancelado", "3-cancelado"],
  ["4-reagendar", "4-reagendar"],
]);

const normalizeEstadoValue = (value?: string | null) => {
  if (!value) return undefined;
  return estadoMap.get(value) ?? value;
};

const SummaryItem = ({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string | null;
}) => (
  <div className="space-y-1">
    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
      {label}
    </p>
    <p className="text-base font-semibold text-foreground line-clamp-2">{value}</p>
    {helper ? <p className="text-xs text-muted-foreground line-clamp-2">{helper}</p> : null}
  </div>
);

export const CRMEventoForm = () => (
  <div className="w-full max-w-6xl mr-auto ml-0">
    <SimpleForm
      className="w-full max-w-none"
      warnWhenUnsavedChanges
      toolbar={<FormToolbar className="mt-6 rounded-2xl border border-border/50 bg-background/80 p-4 shadow-sm" />}
    >
      <CRMEventoFormContent />
    </SimpleForm>
  </div>
);

const CRMEventoFormContent = () => {
  const record = useRecordContext<CRMEvento>();
  const form = useFormContext();
  const control = form.control;

  const oportunidadWatch = useWatch({ control, name: "oportunidad_id" });
  const tituloWatch = useWatch({ control, name: "titulo" });
  const tipoEventoWatch = useWatch({ control, name: "tipo_evento" });
  const fechaEventoWatch = useWatch({ control, name: "fecha_evento" });
  const estadoWatch = useWatch({ control, name: "estado_evento" });
  const asignadoWatch = useWatch({ control, name: "asignado_a_id" });
  const resultadoWatch = useWatch({ control, name: "resultado" });

  const oportunidadId = parseNumericId(oportunidadWatch ?? record?.oportunidad_id);
  const asignadoId = parseNumericId(asignadoWatch ?? record?.asignado_a_id);

  const { data: asignado } = useGetOne("users", { id: asignadoId ?? 0 }, { enabled: Boolean(asignadoId) });
  const { data: oportunidad } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadId ?? 0 },
    { enabled: Boolean(oportunidadId) }
  );
  
  const contactoId = oportunidad?.contacto_id;
  const propiedadId = oportunidad?.propiedad_id;
  
  const { data: contacto } = useGetOne(
    "crm/contactos",
    { id: contactoId ?? 0 },
    { enabled: Boolean(contactoId) }
  );
  const { data: propiedad } = useGetOne(
    "propiedades",
    { id: propiedadId ?? 0 },
    { enabled: Boolean(propiedadId) }
  );

  const tituloValue = (tituloWatch ?? record?.titulo ?? "").trim();
  const tipoEventoValue = (tipoEventoWatch ?? record?.tipo_evento ?? "") as string;
  const fechaEventoValue = fechaEventoWatch ?? record?.fecha_evento;
  const rawEstadoValue = (estadoWatch as string) ?? record?.estado_evento;
  const normalizedEstado = normalizeEstadoValue(rawEstadoValue);
  const estadoValue = normalizedEstado ?? "1-pendiente";
  const resultadoValue = resultadoWatch || record?.resultado || "";

  const responsableNombre =
    asignado?.nombre ??
    (asignadoId ? `Usuario #${asignadoId}` : "Asigna un responsable");
  const tipoEventoNombre = tipoEventoValue
    ? tipoEventoValue.charAt(0).toUpperCase() + tipoEventoValue.slice(1)
    : "Sin tipo";
  const estadoBadgeClass = estadoValue && estadoValue.includes('-')
    ? (ESTADO_BADGES[estadoValue.split('-')[1] as keyof typeof ESTADO_BADGES] ?? "bg-slate-200 text-slate-800")
    : (ESTADO_BADGES[estadoValue as keyof typeof ESTADO_BADGES] ?? "bg-slate-200 text-slate-800");

  const contactoNombre = contacto?.nombre_completo ?? "";
  const propiedadNombre = propiedad?.titulo ?? "";
  const oportunidadTexto = oportunidadId
    ? `#${oportunidadId} · ${oportunidad?.descripcion_estado ?? "Oportunidad"}`
    : "";
  const hasOportunidad = Boolean(oportunidadId);
  
  const oportunidadCardText = hasOportunidad
    ? oportunidadTexto
    : "No se registró una oportunidad vinculada.";
  const oportunidadSecondaryText = hasOportunidad
    ? [contactoNombre, propiedadNombre].filter(Boolean).join(" · ") || "Sin detalles adicionales"
    : null;

  const fechaEventoFormatted = formatDateTime(fechaEventoValue);
  const estadoLabel = estadoValue 
    ? (estadoValue.includes('-') 
        ? estadoValue.split('-')[1].charAt(0).toUpperCase() + estadoValue.split('-')[1].slice(1)
        : estadoValue.charAt(0).toUpperCase() + estadoValue.slice(1))
    : "Sin estado";
  const formTitle = record?.id ? `Evento #${record.id}` : "Nuevo evento";
  const formSubtitle = record?.id
    ? `${tipoEventoNombre} · ${fechaEventoFormatted}`
    : "Completa los datos para agendar el evento.";

  useEffect(() => {
    if (normalizedEstado && normalizedEstado !== rawEstadoValue) {
      form.setValue("estado_evento", normalizedEstado, { shouldDirty: false, shouldTouch: false });
    }
  }, [normalizedEstado, rawEstadoValue, form]);

  return (
    <div className="mr-auto flex w-full max-w-6xl flex-col gap-6 rounded-[32px] border border-border/60 bg-background/80 p-4 shadow-lg backdrop-blur lg:flex-row lg:items-stretch">
      <Card className="flex w-full flex-col gap-6 rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-8 shadow-xl lg:basis-[64%] lg:self-stretch">
        <div className="space-y-6 rounded-[28px] border border-border/40 bg-background/80 p-6 shadow-inner">
          <div className="flex flex-col gap-3 border-b border-border/30 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Evento</p>
              <p className="text-sm text-muted-foreground">{formSubtitle}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="text-left sm:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Responsable</p>
                <p className="text-sm font-semibold text-foreground">{responsableNombre}</p>
              </div>
              <Badge
                variant="outline"
                className={`${estadoBadgeClass} border border-border/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide shadow-sm`}
              >
                {estadoLabel}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-4 border-b border-border/30 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <SummaryItem label="Título" value={tituloValue || "Sin título"} />
            </div>
            <div className="w-full text-left lg:max-w-[260px]">
              <div className="rounded-xl border border-border/30 bg-background text-xs text-left shadow-sm">
                <div className="px-3 pb-2 pt-2 space-y-1">
                  <p className="font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
                    Oportunidad
                  </p>
                  {hasOportunidad ? (
                    <>
                      <p className="text-sm font-medium text-foreground">{oportunidadCardText}</p>
                      {oportunidadSecondaryText && (
                        <p className="text-xs text-muted-foreground pt-0.5">{oportunidadSecondaryText}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {oportunidadCardText}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-muted/30 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground mb-1">
              Resultado
            </p>
            <p className="text-sm text-foreground">{resultadoValue || "Sin resultado registrado aún."}</p>
          </div>
        </div>
        <FormLayout
          sections={[
            {
              id: "detalle-evento",
              title: "Detalle del evento",
              defaultOpen: false,
              children: <DatosEventoSection />,
            },
            {
              id: "seguimiento",
              title: "Seguimiento",
              defaultOpen: false,
              children: <SeguimientoSection />,
            },
          ]}
        />
      </Card>
      <Card className="flex w-full flex-col gap-4 rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-7 shadow-xl lg:basis-[36%] lg:self-stretch">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Actividades
          </p>
          <h3 className="text-xl font-semibold text-foreground">Seguimiento</h3>
          <p className="text-xs text-muted-foreground">
            Revisa y agenda nuevas interacciones relacionadas con este evento y su oportunidad.
          </p>
        </div>
        <div className="flex-1">
          <ActividadesPanel
            oportunidadId={oportunidadId}
            forceShowActions
            className="bg-gradient-to-b from-white/80 to-slate-50/60"
          />
        </div>
      </Card>
    </div>
  );
};

const DatosEventoSection = () => (
  <FormSimpleSection className="space-y-6">
    <TextInput source="titulo" label="Título" className="w-full" validate={required()} />
    <TextInput source="descripcion" label="Descripción" multiline rows={3} className="w-full" />
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <SelectInput
        source="tipo_evento"
        label="Tipo de evento"
        choices={[
          { id: "llamada", name: "Llamada" },
          { id: "reunion", name: "Reunión" },
          { id: "visita", name: "Visita" },
          { id: "email", name: "Email" },
          { id: "whatsapp", name: "WhatsApp" },
          { id: "nota", name: "Nota" },
        ]}
        className="w-full"
        validate={required()}
      />
      <ReferenceInput source="asignado_a_id" reference="users" label="Asignado a">
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
    </div>
  </FormSimpleSection>
);

const SeguimientoSection = () => (
  <FormSimpleSection className="space-y-6">
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <TextInput
        source="fecha_evento"
        label="Fecha y hora"
        type="datetime-local"
        className="w-full"
        validate={required()}
      />
      <SelectInput
        source="estado_evento"
        label="Estado"
        choices={CRM_EVENTO_ESTADO_CHOICES}
        className="w-full"
      />
    </div>
    <TextInput source="resultado" label="Resultado" multiline className="w-full" />
  </FormSimpleSection>
);
