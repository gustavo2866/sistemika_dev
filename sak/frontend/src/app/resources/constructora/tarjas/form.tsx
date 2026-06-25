"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required, useWrappedSource } from "ra-core";
import { useCallback } from "react";
import { useWatch } from "react-hook-form";
import { FormOrderCancelButton, FormOrderSaveButton } from "@/components/forms";
import {
  DetailFieldCell,
  FORM_FIELD_READONLY_CLASS,
  FormDate,
  FormErrorSummary,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormSelectFijo,
  FormText,
  HiddenInput,
  resolveNumericId,
  SectionBaseTemplate,
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { cn } from "@/lib/utils";
import { estadoTarjaChoices } from "./constants";
import {
  TARJA_DEFAULTS,
  getTarjaDetalleDefaults,
  tarjaSchema,
  VALIDATION_RULES,
  type TarjaFormValues,
} from "./model";

const getNominaLabel = (record?: Record<string, unknown>) => {
  if (!record) return "";
  const nombre = [record.nombre, record.apellido]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .trim();
  return nombre || (typeof record.dni === "string" ? record.dni : "");
};

const TarjaMainFields = () => (
  <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_130px_130px_120px_minmax(180px,0.8fr)] md:items-start">
    <ReferenceInput source="idproyecto" reference="proyectos" label="Proyecto">
      <FormSelect
        optionText="nombre"
        widthClass="w-full"
        emptyText="Seleccionar"
        validate={required()}
      />
    </ReferenceInput>
    <FormDate
      source="fechainicio"
      label="Inicio"
      validate={required()}
      widthClass="w-full md:w-[130px]"
    />
    <FormDate
      source="fechafinal"
      label="Final"
      validate={required()}
      widthClass="w-full md:w-[130px]"
    />
    <FormSelect
      source="estado"
      label="Estado"
      choices={estadoTarjaChoices}
      widthClass="w-full md:w-[120px]"
      validate={required()}
    />
    <FormText
      source="descripcion"
      label="Descripcion"
      widthClass="w-full"
      maxLength={VALIDATION_RULES.DESCRIPCION.MAX_LENGTH}
    />
  </div>
);

const TarjaDetalleFields = () => {
  const columns: SectionDetailColumn[] = [
    { label: "Empleado", width: "190px", mobileSpan: "full" },
    { label: "Fecha", width: "104px" },
    { label: "Estado", width: "122px" },
    { label: "Horas", width: "54px" },
    { label: "Descripcion", width: "minmax(150px,1fr)", mobileSpan: "full" },
    { label: "", width: "minmax(54px,auto)" },
  ];

  const DetalleCamposPrincipales = useCallback(
    (props: SectionDetailFieldsProps) => <TarjaDetalleMainFields {...props} />,
    [],
  );

  return (
    <SectionDetailTemplate2
      title="Detalle"
      mainColumns={columns}
      mainFields={DetalleCamposPrincipales}
      defaults={getTarjaDetalleDefaults}
      maxHeightClassName="md:max-h-[calc(100vh-500px)]"
      saveOnlyWhenActive
      showDeleteWhenInactive
      showExpandActionOnMobile
      showExpandAction={false}
      showInfoAction={false}
      addButtonLabel="Agregar detalle"
      detailIteratorClassName={
        "[&_li]:!border-b [&_li]:!border-slate-200/70 [&_li:last-child]:!border-b-0 " +
        "[&_[data-focus-scope=detail-row]]:text-[9px] " +
        "[&_[data-focus-scope=detail-row]]:sm:text-[10px] " +
        "[&_[data-focus-scope=detail-row]]:!py-0 " +
        "[&_[data-focus-scope=detail-row].is-active]:sm:!p-1 " +
        "[&_[data-focus-scope=detail-row].is-active]:sm:!py-0.5"
      }
    />
  );
};

const TarjaDetalleMainFields = ({ isActive }: SectionDetailFieldsProps) => {
  const descripcionSource = useWrappedSource("descripcion");
  const descripcion = useWatch({ name: descripcionSource }) as string | undefined;
  const proyectoValue = useWatch({ name: "idproyecto" });
  const proyectoId = resolveNumericId(proyectoValue);
  const hasDescripcion = Boolean(descripcion?.trim());
  const readOnlyClassName = !isActive ? FORM_FIELD_READONLY_CLASS : undefined;
  const nominaFilter = {
    activo: true,
    ...(proyectoId ? { idproyecto: proyectoId } : {}),
  };

  return (
    <>
      <DetailFieldCell label="Empleado" data-focus-field="true">
        <FormReferenceAutocomplete
          referenceProps={{
            source: "idnomina",
            reference: "nominas",
            filter: nominaFilter,
            sort: { field: "apellido", order: "ASC" },
          }}
          inputProps={{
            optionText: getNominaLabel,
            inputText: getNominaLabel,
            label: false,
            validate: required(),
            placeholder: "Seleccionar",
          }}
          widthClass="w-[190px]"
          className={cn(
            "[&_button[role=combobox]]:h-4 [&_button[role=combobox]]:px-1 [&_button[role=combobox]]:py-0 [&_button[role=combobox]]:text-[9px] " +
              "sm:[&_button[role=combobox]]:h-4.5 sm:[&_button[role=combobox]]:px-1.5 sm:[&_button[role=combobox]]:text-[10px] " +
              "[&_button[role=combobox]>span]:text-[9px] sm:[&_button[role=combobox]>span]:text-[10px]",
            readOnlyClassName,
          )}
        />
      </DetailFieldCell>
      <DetailFieldCell label="Fecha">
        <FormDate
          source="fecha"
          label={false}
          validate={required()}
          readOnly={!isActive}
          widthClass="w-full"
          className={cn(
            "[&_input]:h-4 [&_input]:px-1 [&_input]:text-[9px] sm:[&_input]:h-4.5 sm:[&_input]:px-1.5 sm:[&_input]:text-[10px]",
            readOnlyClassName,
          )}
        />
      </DetailFieldCell>
      <DetailFieldCell label="Estado">
        <ReferenceInput
          source="idestado"
          reference="parte-diario-estados"
          filter={{ activo: true }}
        >
          <FormSelectFijo
            optionText="nombre"
            label={false}
            emptyText="Sin estado"
            fixedWidth="122px"
            widthClass="w-[122px]"
            className={readOnlyClassName}
            triggerProps={{
              className:
                "min-h-4 h-auto px-1 py-0 text-left text-[9px] whitespace-normal sm:min-h-4.5 sm:text-[10px] " +
                "*:data-[slot=select-value]:line-clamp-none " +
                "*:data-[slot=select-value]:whitespace-normal " +
                "*:data-[slot=select-value]:break-words " +
                "*:data-[slot=select-value]:leading-tight",
            }}
          />
        </ReferenceInput>
      </DetailFieldCell>
      <DetailFieldCell label="Horas" className="gap-0">
        <FormNumber
          source="horas"
          label={false}
          inputMode="decimal"
          step={0.25}
          min={VALIDATION_RULES.HORAS.MIN}
          max={VALIDATION_RULES.HORAS.MAX}
          widthClass="w-full"
          validate={required()}
          readOnly={!isActive}
          className={cn(
            "gap-0 [&_input]:h-4 [&_input]:px-1 [&_input]:text-[9px] sm:[&_input]:h-4.5 sm:[&_input]:px-1.5 sm:[&_input]:text-[10px]",
            readOnlyClassName,
          )}
        />
      </DetailFieldCell>
      <DetailFieldCell
        label="Descripcion"
        className={cn(!hasDescripcion && "hidden sm:flex")}
      >
        <FormText
          source="descripcion"
          label={false}
          placeholder="Observacion"
          widthClass="w-full"
          readOnly={!isActive}
          maxLength={VALIDATION_RULES.DETALLE_DESCRIPCION.MAX_LENGTH}
          className={cn(
            "[&_input]:h-4 [&_input]:px-1 [&_input]:text-[9px] sm:[&_input]:h-4.5 sm:[&_input]:px-1.5 sm:[&_input]:text-[10px]",
            readOnlyClassName,
          )}
        />
      </DetailFieldCell>
    </>
  );
};

const TarjaNovedadesFields = () => (
  <SectionBaseTemplate
    title="Novedades"
    main={
      <div className="grid gap-2 md:grid-cols-[150px_130px_130px_minmax(220px,1fr)]">
        <HiddenInput source="novedades.0.id" />
        <FormNumber
          source="novedades.0.horas_enfermedad_justif"
          label="Hs enf. justif."
          widthClass="w-full"
          min={0}
        />
        <FormNumber
          source="novedades.0.presentismo"
          label="Presentismo"
          widthClass="w-full"
          min={0}
        />
        <FormNumber
          source="novedades.0.premio"
          label="Premio"
          widthClass="w-full"
          min={0}
        />
        <FormText
          source="novedades.0.observaciones"
          label="Observaciones"
          widthClass="w-full"
          maxLength={VALIDATION_RULES.OBSERVACIONES.MAX_LENGTH}
        />
      </div>
    }
    defaultOpen
  />
);

const TarjaToolbar = () => (
  <div className="flex w-full items-center justify-end gap-2">
    <FormOrderCancelButton />
    <FormOrderSaveButton variant="secondary" />
  </div>
);

export const TarjaForm = ({
  defaultValues = TARJA_DEFAULTS,
}: {
  defaultValues?: Partial<TarjaFormValues>;
} = {}) => (
  <SimpleForm<TarjaFormValues>
    className="w-full max-w-5xl"
    resolver={zodResolver(tarjaSchema) as any}
    toolbar={<TarjaToolbar />}
    defaultValues={{ ...TARJA_DEFAULTS, ...defaultValues }}
  >
    <FormErrorSummary />
    <SectionBaseTemplate
      title="Informacion general"
      main={<TarjaMainFields />}
      defaultOpen
    />
    <TarjaDetalleFields />
    <TarjaNovedadesFields />
  </SimpleForm>
);
