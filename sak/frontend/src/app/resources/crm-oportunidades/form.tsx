"use client";

import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { required, useRecordContext, useGetOne } from "ra-core";

import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { NumberInput } from "@/components/number-input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormLayout, FormSimpleSection } from "@/components/forms";
import type { CRMOportunidad, CRMOportunidadEstado } from "./model";
import {
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  CRM_OPORTUNIDAD_ESTADO_CHOICES,
  formatEstadoOportunidad,
} from "./model";
import { ActividadesPanel } from "../crm-actividades/Panel";

const parseNumericId = (value?: unknown) => {
  if (value == null || value === "") return undefined;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : undefined;
};

const parseFloatValue = (value?: unknown) => {
  if (value == null || value === "") return undefined;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : undefined;
};

const formatCurrencyValue = (value?: unknown, currencyCode?: string | null) => {
  const numeric = parseFloatValue(value);
  if (numeric == null) {
    return "Sin monto";
  }
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currencyCode ?? "USD",
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return numeric.toString();
  }
};

const formatDateTimeValue = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return "sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";
  return date.toLocaleString("es-AR", options ?? { dateStyle: "short", timeStyle: "short" });
};

type SummaryItemProps = {
  label: string;
  value: string;
  helper?: string;
};

const SummaryItem = ({ label, value, helper }: SummaryItemProps) => (
  <div className="space-y-1">
    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
      {label}
    </p>
    <p className="text-base font-semibold text-foreground line-clamp-2">{value}</p>
    {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
  </div>
);

export const CRMOportunidadForm = () => (
  <SimpleForm
    className="w-full max-w-none"
    warnWhenUnsavedChanges
    toolbar={<FormToolbar className="rounded-2xl border border-border/50 bg-background/80 p-4 shadow-sm" />}
  >
    <OportunidadFormSections />
  </SimpleForm>
);

const OportunidadFormSections = () => {
  const record = useRecordContext<CRMOportunidad>();
  const form = useFormContext();
  const control = form.control;
  const isEditMode = Boolean(record?.id);

  const contactoWatch = useWatch({ control, name: "contacto_id" });
  const propiedadWatch = useWatch({ control, name: "propiedad_id" });
  const responsableWatch = useWatch({ control, name: "responsable_id" });
  const estadoWatch = useWatch({ control, name: "estado" });
  const montoWatch = useWatch({ control, name: "monto" });
  const probabilidadWatch = useWatch({ control, name: "probabilidad" });
  const fechaEstadoWatch = useWatch({ control, name: "fecha_estado" });
  const monedaWatch = useWatch({ control, name: "moneda_id" });
  const fechaCierreWatch = useWatch({ control, name: "fecha_cierre_estimada" });
  const tipoOperacionWatch = useWatch({ control, name: "tipo_operacion_id" });
  const descripcionWatch = useWatch({ control, name: "descripcion_estado" });

  const contactoId = parseNumericId(contactoWatch ?? record?.contacto_id);
  const propiedadId = parseNumericId(propiedadWatch ?? record?.propiedad_id);
  const responsableId = parseNumericId(responsableWatch ?? record?.responsable_id);
  const tipoOperacionId = parseNumericId(tipoOperacionWatch ?? record?.tipo_operacion_id);
  const monedaId = parseNumericId(monedaWatch ?? record?.moneda_id);
  const oportunidadId = parseNumericId(record?.id);

  const { data: contacto } = useGetOne(
    "crm/contactos",
    { id: contactoId ?? 0 },
    { enabled: Boolean(contactoId) }
  );
  const { data: responsable } = useGetOne(
    "users",
    { id: responsableId ?? 0 },
    { enabled: Boolean(responsableId) }
  );
  const { data: moneda } = useGetOne(
    "monedas",
    { id: monedaId ?? 0 },
    { enabled: Boolean(monedaId) }
  );
  const { data: propiedad } = useGetOne(
    "propiedades",
    { id: propiedadId ?? 0 },
    { enabled: Boolean(propiedadId) }
  );
  const { data: tipoOperacion } = useGetOne(
    "crm/catalogos/tipos-operacion",
    { id: tipoOperacionId ?? 0 },
    { enabled: Boolean(tipoOperacionId) }
  );

  const estadoValue = (estadoWatch as string) || record?.estado;
  const montoValue = montoWatch ?? record?.monto;
  const probabilidadValue = probabilidadWatch ?? record?.probabilidad;
  const fechaEstadoValue = fechaEstadoWatch ?? record?.fecha_estado;

  const contactName =
    contacto?.nombre_completo ??
    (contactoId ? `Contacto #${contactoId}` : "Seleccioná un contacto");
  const responsableName =
    responsable?.nombre ?? (responsableId ? `Usuario #${responsableId}` : "Sin asignar");
  const propiedadName =
    propiedad?.nombre ?? (propiedadId ? `Propiedad #${propiedadId}` : "Propiedad sin asignar");
  const montoFormatted = useMemo(
    () => formatCurrencyValue(montoValue, moneda?.codigo),
    [montoValue, moneda?.codigo]
  );
  const monedaLabel = moneda?.simbolo ?? moneda?.codigo ?? moneda?.nombre ?? "";
  const probabilidadFormatted = (() => {
    const numeric = parseFloatValue(probabilidadValue);
    if (numeric == null) return "Sin estimar";
    return `${numeric}%`;
  })();
  const fechaEstadoFormatted = formatDateTimeValue(fechaEstadoValue);
  const fechaCierreFormatted = formatDateTimeValue(fechaCierreWatch, { dateStyle: "short" });
  const estadoLabel = formatEstadoOportunidad(estadoValue as CRMOportunidadEstado);
  const estadoBadgeClass =
    CRM_OPORTUNIDAD_ESTADO_BADGES[estadoValue as CRMOportunidadEstado] ??
    "bg-slate-100 text-slate-800";
  const tipoOperacionLabel =
    tipoOperacion?.nombre ?? (tipoOperacionId ? `Tipo #${tipoOperacionId}` : "Tipo desconocido");
  const descripcionNecesidad =
    (descripcionWatch ?? record?.descripcion_estado ?? "").trim() || "Sin descripción";
  const formTitle = record?.id ? "Editar Oportunidad CRM" : "Nueva Oportunidad CRM";
  const formSubtitle = record?.id
    ? `ID #${record.id}`
    : "Completa los campos para registrar la oportunidad.";

  return (
    <div className="mr-auto flex w-full max-w-6xl flex-col gap-6 rounded-[32px] border border-border/60 bg-background/80 p-4 shadow-lg backdrop-blur lg:flex-row lg:items-stretch">
      <Card className="flex w-full flex-col gap-6 rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-8 shadow-xl lg:basis-[64%] lg:self-stretch">
        <div className="space-y-6 rounded-[28px] border border-border/40 bg-background/80 p-6 shadow-inner">
          <div className="flex flex-col gap-3 border-b border-border/30 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Secci?n
              </p>
              <h2 className="text-3xl font-semibold text-foreground">{formTitle}</h2>
              <p className="text-sm text-muted-foreground">{formSubtitle}</p>
            </div>
            <Badge
              variant="outline"
              className={`${estadoBadgeClass} ml-auto border border-border/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide shadow-sm`}
            >
              {estadoLabel}
            </Badge>
          </div>
          <div className="grid gap-4 border-b border-border/30 pb-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryItem label="Contacto" value={contactName} />
            <SummaryItem label="Tipo de operación" value={tipoOperacionLabel} />
            <SummaryItem label="Propiedad" value={propiedadName} />
          </div>
          <div className="rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Descripción
            </p>
            <p className="mt-1 text-base text-foreground">{descripcionNecesidad}</p>
          </div>
        </div>
        <FormLayout
          spacing="lg"
          sections={[
            {
              id: "datos-generales",
              title: "Datos generales",
              defaultOpen: !isEditMode,
              contentPadding: "lg",
              children: <DatosGeneralesSection />,
            },
            {
              id: "cotizacion",
              title: "Cotizaci?n",
              defaultOpen: false,
              contentPadding: "lg",
              children: <CotizacionSection />,
            },
            {
              id: "estado",
              title: "Estado",
              defaultOpen: false,
              contentPadding: "lg",
              children: (
                <EstadoSection
                  estadoLabel={estadoLabel}
                  probabilidad={probabilidadFormatted}
                  fechaEstado={fechaEstadoFormatted}
                  fechaCierre={fechaCierreFormatted}
                />
              ),
            },
          ]}
        />
      </Card>
      <Card className="flex w-full flex-col gap-4 rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-7 shadow-xl lg:basis-[36%] lg:self-stretch">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Acciones pendientes
          </p>
          <h3 className="text-xl font-semibold text-foreground">Actividades</h3>
        </div>
        <div className="flex-1 h-full">
          <ActividadesPanel
            oportunidadId={oportunidadId}
            contactoId={contactoId}
            contactoNombre={contactName}
            asuntoMensaje={descripcionNecesidad}
            forceShowActions
            className="bg-gradient-to-b from-white/80 to-slate-50/60"
          />
        </div>
      </Card>
    </div>
  );
};

function DatosGeneralesSection() {
  return (
    <FormSimpleSection className="space-y-6">
      <div className="grid grid-cols-1 gap-5">
        <ReferenceInput source="contacto_id" reference="crm/contactos" label="Contacto">
          <SelectInput optionText="nombre_completo" className="w-full" validate={required()} />
        </ReferenceInput>
        <ReferenceInput source="responsable_id" reference="users" label="Responsable">
          <SelectInput optionText="nombre" className="w-full" validate={required()} />
        </ReferenceInput>
        <ReferenceInput
          source="tipo_operacion_id"
          reference="crm/catalogos/tipos-operacion"
          label="Tipo de operación"
        >
          <SelectInput
            optionText={(record) =>
              record?.id
                ? `${record.id} - ${record.nombre ?? record.descripcion ?? record.codigo ?? ""}`
                : ""
            }
            className="w-full"
            validate={required()}
          />
        </ReferenceInput>
        <TextInput source="descripcion_estado" label="Descripción" multiline className="w-full" />
      </div>
    </FormSimpleSection>
  );
}

function CotizacionSection() {
  return (
    <FormSimpleSection className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <ReferenceInput source="propiedad_id" reference="propiedades" label="Propiedad">
            <SelectInput optionText="nombre" className="w-full" validate={required()} />
          </ReferenceInput>
        </div>
        <div className="md:col-span-2">
          <ReferenceInput source="tipo_propiedad_id" reference="tipos-propiedad" label="Tipo de propiedad">
            <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
          </ReferenceInput>
        </div>
        <div>
          <NumberInput source="monto" label="Monto" className="w-full" step="any" />
        </div>
        <div>
          <ReferenceInput source="moneda_id" reference="monedas" label="Moneda">
            <SelectInput
              optionText={(record) =>
                record?.simbolo ? `${record.simbolo}` : record?.codigo || record?.nombre
              }
              emptyText="Seleccionar"
              className="w-full"
            />
          </ReferenceInput>
        </div>
        <div className="md:col-span-2">
          <ReferenceInput
            source="condicion_pago_id"
            reference="crm/catalogos/condiciones-pago"
            label="Condición de pago"
          >
            <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
          </ReferenceInput>
        </div>
      </div>
    </FormSimpleSection>
  );
}

type EstadoSectionProps = {
  estadoLabel: string;
  probabilidad: string;
  fechaEstado: string;
  fechaCierre: string;
};

function EstadoSection({ estadoLabel, probabilidad, fechaEstado, fechaCierre }: EstadoSectionProps) {
  return (
    <FormSimpleSection className="space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <SelectInput
            source="estado"
            label="Estado"
            choices={CRM_OPORTUNIDAD_ESTADO_CHOICES}
            className="w-full"
            defaultValue="1-abierta"
          />
          <TextInput source="fecha_estado" label="Fecha estado" type="datetime-local" className="w-full" />
          <ReferenceInput source="motivo_perdida_id" reference="crm/catalogos/motivos-perdida" label="Motivo pérdida">
            <SelectInput optionText="nombre" emptyText="Sin asignar" className="w-full" />
          </ReferenceInput>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberInput source="probabilidad" label="Probabilidad (%)" min={0} max={100} className="w-full" />
          <TextInput source="fecha_cierre_estimada" label="Cierre estimado" type="date" className="w-full" />
        </div>
      </div>
    </FormSimpleSection>
  );
}
