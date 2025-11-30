"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { NumberInput } from "@/components/number-input";
import { required, useDataProvider, useRecordContext, useGetOne } from "ra-core";
import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FormLayout, FormSimpleSection } from "@/components/forms";
import type { CRMOportunidad } from "./model";
import { CRM_OPORTUNIDAD_ESTADO_CHOICES, formatEstadoOportunidad } from "./model";
import ActividadTimeline from "./ActividadTimeline";

export const CRMOportunidadForm = () => (
  <SimpleForm warnWhenUnsavedChanges>
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

  const contactoId = parseNumericId(contactoWatch ?? record?.contacto_id);
  const propiedadId = parseNumericId(propiedadWatch ?? record?.propiedad_id);
  const responsableId = parseNumericId(responsableWatch ?? record?.responsable_id);
  const monedaId = parseNumericId(monedaWatch ?? record?.moneda_id);

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
  const estadoLabel = formatEstadoOportunidad(estadoValue as any);

  const datosSubtitle = [contactName, responsableName ? `Resp. ${responsableName}` : null]
    .filter(Boolean)
    .join(" · ");
  const cotizacionSubtitle = [
    propiedadName,
    montoFormatted !== "Sin monto" ? montoFormatted : null,
    monedaLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const estadoSubtitle = [
    estadoLabel,
    fechaEstadoFormatted ? `Actualizado ${fechaEstadoFormatted}` : null,
    fechaCierreFormatted && fechaCierreWatch ? `Cierre ${fechaCierreFormatted}` : null,
    `Prob. ${probabilidadFormatted}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <FormLayout
      spacing="lg"
      sections={[
        {
          id: "datos-generales",
          title: "Datos generales",
          subtitle: datosSubtitle || "Información clave del contacto y responsable.",
          defaultOpen: !isEditMode,
          contentPadding: "lg",
          children: <DatosGeneralesSection />,
        },
        {
          id: "cotizacion",
          title: "Cotización",
          subtitle: cotizacionSubtitle || "Definí los montos, moneda y expectativas de cierre.",
          defaultOpen: false,
          contentPadding: "lg",
          children: <CotizacionSection />,
        },
        {
          id: "estado",
          title: "Estado",
          subtitle: estadoSubtitle || `Estado actual: ${estadoLabel}`,
          defaultOpen: false,
          contentPadding: "lg",
          children: <EstadoSection />,
        },
        {
          id: "actividad",
          title: "Actividad",
          subtitle: "Eventos y mensajes más recientes vinculados a la oportunidad.",
          defaultOpen: false,
          contentPadding: "md",
          children: <ActividadTimeline />,
        },
      ]}
    />
  );
};

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
  return date.toLocaleString(
    "es-AR",
    options ?? { dateStyle: "short", timeStyle: "short" }
  );
};

const DatosGeneralesSection = () => (
  <FormSimpleSection className="space-y-5">
    <div className="grid grid-cols-1 gap-5">
      <ReferenceInput source="contacto_id" reference="crm/contactos" label="Contacto">
        <SelectInput optionText="nombre_completo" className="w-full" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source="responsable_id" reference="users" label="Responsable">
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
                <ReferenceInput
                  source="tipo_operacion_id"
                  reference="tipos-operacion"
                  label="Tipo de operacion"
                >
                  <SelectInput
                    optionText={(record) =>
                      record?.id ? `${record.id} - ${record.descripcion ?? record.codigo ?? ""}` : ""
                    }
                    className="w-full"
                    validate={required()}
                  />
                </ReferenceInput>
      <TextInput source="descripcion_estado" label="Descripci?n" multiline className="w-full" />
    </div>
  </FormSimpleSection>
);

const CotizacionSection = () => (
  <FormSimpleSection className="space-y-5">
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
        <ReferenceInput source="condicion_pago_id" reference="crm/catalogos/condiciones-pago" label="Condición de pago">
          <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
        </ReferenceInput>
      </div>
    </div>
  </FormSimpleSection>
);

const EstadoSection = () => (
  <FormSimpleSection className="space-y-5">
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <SelectInput
        source="estado"
        label="Estado"
        choices={CRM_OPORTUNIDAD_ESTADO_CHOICES}
        className="w-full"
        defaultValue="1-abierta"
      />
      <TextInput source="fecha_estado" label="Fecha estado" type="datetime-local" className="w-full" />
      <ReferenceInput source="motivo_perdida_id" reference="crm/catalogos/motivos-perdida" label="Motivo p?rdida">
        <SelectInput optionText="nombre" emptyText="Sin asignar" className="w-full" />
      </ReferenceInput>
      <NumberInput source="probabilidad" label="Probabilidad (%)" min={0} max={100} className="w-full" />
      <TextInput source="fecha_cierre_estimada" label="Cierre estimado" type="date" className="w-full" />
    </div>
  </FormSimpleSection>
);
