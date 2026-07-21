"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required, useGetList, useGetOne, useWrappedSource } from "ra-core";
import { useCallback } from "react";
import { useWatch } from "react-hook-form";
import { FormOrderCancelButton, FormOrderSaveButton } from "@/components/forms";
import {
  DetailFieldCell,
  FORM_FIELD_READONLY_CLASS,
  FormDate,
  FormErrorSummary,
  FormNumber,
  FormValue,
  FormReferenceAutocomplete,
  FormSelect,
  FormSelectFijo,
  FormText,
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
  type TarjaDetalle,
  type TarjaFormValues,
} from "./model";

const getNominaLabel = (
  record?: Record<string, unknown>,
  tarjaProyectoId?: number | null,
) => {
  if (!record) return "";
  const proyecto = record.proyecto as { nombre?: string | null } | null | undefined;
  const empleadoProyectoId = resolveNumericId(record.idproyecto);
  const nombre = [record.nombre, record.apellido]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .trim();
  const empleado = nombre || (typeof record.dni === "string" ? record.dni : "");
  const obra = proyecto?.nombre?.trim().slice(0, 15);
  const showObra = Boolean(
    obra &&
      tarjaProyectoId != null &&
      empleadoProyectoId != null &&
      empleadoProyectoId !== tarjaProyectoId,
  );
  return showObra ? `${empleado} (${obra})` : empleado;
};

type ParteDiarioEstadoRecord = {
  id: number | string;
  nombre?: string | null;
  abreviatura?: string | null;
};

const TarjaEmpleadoValue = ({
  idnomina,
  nomina,
  proyectoId,
  className,
}: {
  idnomina?: unknown;
  nomina?: TarjaDetalle["nomina"];
  proyectoId?: number | null;
  className?: string;
}) => {
  const nominaId = resolveNumericId(idnomina);
  const { data: fetchedNomina } = useGetOne<{ id: number; [key: string]: unknown }>(
    "nominas",
    { id: nominaId ?? 0 },
    { enabled: nominaId != null && !nomina },
  );
  const record = (nomina ?? fetchedNomina) as Record<string, unknown> | undefined;
  const label = getNominaLabel(record, proyectoId) || (nominaId ? `Empleado #${nominaId}` : "Sin empleado");

  return (
    <FormValue widthClass="w-[190px]" valueClassName={className}>
      <span className="block min-w-0 truncate">{label}</span>
    </FormValue>
  );
};

const TarjaMainFields = () => (
  <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_160px_130px_120px] md:items-start">
    <ReferenceInput source="idproyecto" reference="proyectos" label="Proyecto">
      <FormSelect
        optionText="nombre"
        widthClass="w-full"
        emptyText="Seleccionar"
        validate={required()}
      />
    </ReferenceInput>
    <ReferenceInput source="contacto_id" reference="crm/contactos" label="Encargado">
      <FormSelectFijo
        optionText="nombre_completo"
        fixedWidth="160px"
        widthClass="w-[160px]"
        emptyText="Sin encargado"
      />
    </ReferenceInput>
    <FormDate
      source="fechainicio"
      label="Inicio"
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
  </div>
);

const TarjaOptionalFields = () => (
  <div className="mt-1 rounded-md border border-muted/60 bg-muted/30 p-2">
    <div className="grid gap-2 md:grid-cols-[130px_260px] md:items-start">
      <FormDate
        source="fechafinal"
        label="Final"
        widthClass="w-full md:w-[130px]"
      />
      <FormText
        source="descripcion"
        label="Descripcion"
        widthClass="w-full md:w-[260px]"
        maxLength={VALIDATION_RULES.DESCRIPCION.MAX_LENGTH}
      />
    </div>
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
    <div className="flex flex-col gap-0">
      <SectionDetailTemplate2
        title="Detalle"
        mainColumns={columns}
        mainFields={DetalleCamposPrincipales}
        defaults={getTarjaDetalleDefaults}
        maxHeightClassName="md:h-[calc((100vh-430px)*0.6)] md:min-h-[156px] md:max-h-[calc((100vh-430px)*0.6)]"
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
      <TarjaResumenTotales />
    </div>
  );
};

const TarjaDetalleMainFields = ({ isActive }: SectionDetailFieldsProps) => {
  const descripcionSource = useWrappedSource("descripcion");
  const nominaSource = useWrappedSource("nomina");
  const idnominaSource = useWrappedSource("idnomina");
  const descripcion = useWatch({ name: descripcionSource }) as string | undefined;
  const nomina = useWatch({ name: nominaSource }) as TarjaDetalle["nomina"] | undefined;
  const idnomina = useWatch({ name: idnominaSource });
  const proyectoValue = useWatch({ name: "idproyecto" });
  const proyectoId = resolveNumericId(proyectoValue);
  const hasDescripcion = Boolean(descripcion?.trim());
  const readOnlyClassName = !isActive ? FORM_FIELD_READONLY_CLASS : undefined;
  const nominaFilter = {
    activo: true,
  };
  const getEmpleadoLabel = useCallback(
    (record?: Record<string, unknown>) => getNominaLabel(record, proyectoId),
    [proyectoId],
  );

  return (
    <>
      <DetailFieldCell label="Empleado" data-focus-field="true">
        {!isActive ? (
          <TarjaEmpleadoValue
            idnomina={idnomina}
            nomina={nomina}
            proyectoId={proyectoId}
            className={cn(
              "h-4 justify-start px-1 text-left text-[9px] sm:h-4.5 sm:px-1.5 sm:text-[10px]",
              readOnlyClassName,
            )}
          />
        ) : (
          <FormReferenceAutocomplete
            referenceProps={{
              source: "idnomina",
              reference: "nominas",
              filter: nominaFilter,
              sort: { field: "apellido", order: "ASC" },
            }}
            inputProps={{
              optionText: getEmpleadoLabel,
              inputText: getEmpleadoLabel,
              label: false,
              validate: required(),
              placeholder: "Seleccionar",
            }}
            widthClass="w-[190px]"
            className={cn(
              "[&_button[role=combobox]]:h-4 [&_button[role=combobox]]:px-1 [&_button[role=combobox]]:py-0 [&_button[role=combobox]]:text-[9px] " +
                "sm:[&_button[role=combobox]]:h-4.5 sm:[&_button[role=combobox]]:px-1.5 sm:[&_button[role=combobox]]:text-[10px] " +
                "[&_button[role=combobox]]:text-left [&_button[role=combobox]>span]:text-left [&_button[role=combobox]>span]:text-[9px] sm:[&_button[role=combobox]>span]:text-[10px]",
              readOnlyClassName,
            )}
          />
        )}
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

const TarjaToolbar = () => (
  <div className="flex w-full items-center justify-end gap-2">
    <FormOrderCancelButton />
    <FormOrderSaveButton variant="secondary" />
  </div>
);

const TarjaResumenTotales = () => {
  const detalles = useWatch({ name: "detalles" }) as
    | Array<{ idnomina?: unknown; horas?: unknown; idestado?: unknown }>
    | undefined;
  const { data: estados = [] } = useGetList<ParteDiarioEstadoRecord>(
    "parte-diario-estados",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "orden", order: "ASC" },
      filter: { activo: true },
    },
  );
  const presenteIds = new Set(
    estados
      .filter((estado) => {
        const abreviatura = String(estado.abreviatura ?? "").trim().toUpperCase();
        const nombre = String(estado.nombre ?? "").trim().toUpperCase();
        return abreviatura === "P" || nombre === "PRESENTE";
      })
      .map((estado) => resolveNumericId(estado.id))
      .filter((id): id is number => id != null),
  );
  const registros = (detalles ?? []).filter(
    (detalle) => detalle?.idnomina != null && detalle.idnomina !== "",
  );
  const totalHoras = registros.reduce((total, detalle) => {
    const horas = Number(detalle.horas ?? 0);
    return total + (Number.isFinite(horas) ? horas : 0);
  }, 0);
  const presentes = registros.filter((detalle) => {
    const idestado = resolveNumericId(detalle.idestado);
    return idestado != null && presenteIds.has(idestado);
  }).length;
  const ausentes = Math.max(0, registros.length - presentes);

  return (
    <div className="flex flex-row flex-nowrap items-center justify-end gap-1.5 rounded-md border border-muted/50 bg-muted/15 px-2 py-0.5 text-[8px] text-muted-foreground sm:gap-2 sm:px-2.5 sm:py-1 sm:text-[9px]">
      <span className="flex items-center gap-1 rounded-full border border-muted-foreground/15 bg-background px-1.5 py-0 text-[8px] font-medium text-muted-foreground whitespace-nowrap sm:px-2 sm:text-[9px]">
        Registros: {registros.length}
      </span>
      <span className="flex items-center gap-1 rounded-full border border-muted-foreground/15 bg-background px-1.5 py-0 text-[8px] font-medium text-muted-foreground whitespace-nowrap sm:px-2 sm:text-[9px]">
        Horas: {totalHoras.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
      </span>
      <span className="flex items-center gap-1 rounded-full border border-muted-foreground/15 bg-background px-1.5 py-0 text-[8px] font-medium text-muted-foreground whitespace-nowrap sm:px-2 sm:text-[9px]">
        Presentes: {presentes}
      </span>
      <span className="flex items-center gap-1 rounded-full border border-muted-foreground/15 bg-background px-1.5 py-0 text-[8px] font-medium text-muted-foreground whitespace-nowrap sm:px-2 sm:text-[9px]">
        Ausentes: {ausentes}
      </span>
    </div>
  );
};

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
      optional={<TarjaOptionalFields />}
      defaultOpen
    />
    <TarjaDetalleFields />
  </SimpleForm>
);
