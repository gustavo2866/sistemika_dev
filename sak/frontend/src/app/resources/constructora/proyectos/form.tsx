"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  required,
  useRecordContext,
} from "ra-core";
import { useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import { NumberField } from "@/components/number-field";
import {
  DetailFieldCell,
  FormDate,
  FormErrorSummary,
  FORM_FIELD_READONLY_CLASS,
  FormNumber,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2,
} from "@/components/forms/form_order";
import { FormOrderToolbar } from "@/components/forms";
import {
  PROYECTO_DEFAULTS,
  PROYECTO_VALIDATIONS,
  computeProyectoPresupuestoTotal,
  getProyectoAvanceDefaults,
  getProyectoHorasTotales,
  getProyectoUltimoAvance,
  proyectoSchema,
  type ProyectoFormValues,
} from "./model";

const ProyectoCabeceraMainFields = () => (
  <div className="grid gap-2 md:grid-cols-4">
    <FormText
      source="nombre"
      label="Nombre"
      validate={required()}
      widthClass="w-full"
      className="md:col-span-2"
      maxLength={PROYECTO_VALIDATIONS.NOMBRE_MAX}
    />
    <FormText
      source="estado"
      label="Estado"
      widthClass="w-full"
      maxLength={PROYECTO_VALIDATIONS.ESTADO_MAX}
    />
    <FormNumber
      source="centro_costo"
      label="Centro de costo"
      step="1"
      widthClass="w-full"
    />
    <FormDate
      source="fecha_inicio"
      label="Fecha de inicio"
      widthClass="w-full"
    />
    <FormDate
      source="fecha_final"
      label="Fecha final"
      widthClass="w-full"
    />
    <FormNumber
      source="superficie"
      label="Superficie %"
      step="0.01"
      widthClass="w-full"
    />
    <FormNumber
      source="ingresos"
      label="Ingresos"
      step="0.01"
      widthClass="w-full"
    />
  </div>
);

const ProyectoCabeceraOptionalFields = () => (
  <div className="mt-1 rounded-md border border-muted/60 bg-muted/30 p-2">
    <div className="grid gap-2 md:grid-cols-4">
      <FormNumber
        source="importe_mat"
        label="Materiales"
        step="0.01"
        widthClass="w-full"
      />
      <FormNumber
        source="importe_mo"
        label="Mano de obra"
        step="0.01"
        widthClass="w-full"
      />
      <FormNumber
        source="terceros"
        label="Terceros"
        step="0.01"
        widthClass="w-full"
      />
      <FormNumber
        source="herramientas"
        label="Herramientas"
        step="0.01"
        widthClass="w-full"
      />
      <FormTextarea
        source="comentario"
        label="Comentario"
        widthClass="w-full md:col-span-4"
        className="md:col-span-4 [&_textarea]:min-h-[72px]"
        maxLength={PROYECTO_VALIDATIONS.COMENTARIO_MAX}
      />
    </div>
  </div>
);

const ProyectoDetalleMainFields = ({ isActive }: SectionDetailFieldsProps) => (
  <>
    <DetailFieldCell label="Fecha" data-focus-field="true">
      <FormDate
        source="fecha_registracion"
        label={false}
        widthClass="w-full"
        readOnly={!isActive}
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Horas">
      <FormNumber
        source="horas"
        label={false}
        widthClass="w-full"
        step="1"
        min={0}
        validate={required()}
        readOnly={!isActive}
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="% Avance">
      <FormNumber
        source="avance"
        label={false}
        widthClass="w-full"
        step="0.01"
        min={0}
        max={100}
        validate={required()}
        readOnly={!isActive}
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Comentario">
      <FormText
        source="comentario"
        label={false}
        widthClass="w-full"
        readOnly={!isActive}
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
  </>
);

const ResumenProyecto = () => {
  const importes = useWatch({
    name: ["importe_mat", "importe_mo", "terceros", "herramientas", "ingresos", "avances"],
  }) as [number?, number?, number?, number?, number?, ProyectoFormValues["avances"]?];

  const [importeMat, importeMo, terceros, herramientas, ingresos, avances] = importes;
  const presupuesto = computeProyectoPresupuestoTotal({
    importe_mat: importeMat,
    importe_mo: importeMo,
    terceros,
    herramientas,
  });
  const horas = getProyectoHorasTotales(avances);
  const avanceActual = getProyectoUltimoAvance(avances);

  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border border-muted/60 bg-muted/30 px-2 py-2 text-[8px] text-muted-foreground sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:px-3 sm:py-2 sm:text-[10px]">
      <span className="flex items-center gap-1 whitespace-nowrap min-w-0">
        Presupuesto:
        <NumberField
          source="presupuesto"
          record={{ presupuesto }}
          options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          className="text-foreground tabular-nums"
        />
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap min-w-0">
        Ingresos:
        <NumberField
          source="ingresos"
          record={{ ingresos: Number(ingresos ?? 0) }}
          options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          className="text-foreground tabular-nums"
        />
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap min-w-0">
        Horas:
        <NumberField
          source="horas"
          record={{ horas }}
          options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
          className="text-foreground tabular-nums"
        />
      </span>
      <span className="flex items-center justify-center gap-1.5 rounded-full bg-foreground/90 px-2 py-1 text-[8px] font-semibold text-background whitespace-nowrap sm:justify-start sm:px-2.5 sm:py-1 sm:text-[10px]">
        Avance:
        <NumberField
          source="avance"
          record={{ avance: avanceActual }}
          options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
          className="tabular-nums"
        />
        %
      </span>
    </div>
  );
};

export const ProyectoForm = () => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const defaultValues = useMemo(
    () => (record?.id ? undefined : PROYECTO_DEFAULTS),
    [record?.id],
  );

  const detailColumns: SectionDetailColumn[] = [
    { label: "Fecha", width: "130px", mobileSpan: 1 },
    { label: "Horas", width: "72px", mobileSpan: 1, className: "text-center" },
    { label: "% Avance", width: "82px", mobileSpan: 1, className: "text-center" },
    { label: "Comentario", width: "minmax(220px,1fr)", mobileSpan: "full" },
    { label: "", width: "28px" },
  ];

  return (
    <SimpleForm<ProyectoFormValues>
      className="w-full max-w-5xl"
      resolver={zodResolver(proyectoSchema) as any}
      toolbar={<FormOrderToolbar saveProps={{ variant: "secondary" }} />}
      defaultValues={defaultValues}
    >
      <FormErrorSummary />
      <SectionBaseTemplate
        title="Cabecera"
        main={<ProyectoCabeceraMainFields />}
        optional={<ProyectoCabeceraOptionalFields />}
        defaultOpen
      />
      <SectionDetailTemplate2
        title="Avances"
        detailsSource="avances"
        mainColumns={detailColumns}
        mainFields={ProyectoDetalleMainFields}
        defaults={getProyectoAvanceDefaults}
        maxHeightClassName="md:max-h-56"
      />
      <ResumenProyecto />
    </SimpleForm>
  );
};
