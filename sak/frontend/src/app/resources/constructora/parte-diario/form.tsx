"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { fetchUtils, required, useNotify, useWrappedSource } from "ra-core";
import { useCallback, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { UserPlus, UserX } from "lucide-react";
import { Confirm } from "@/components/confirm";
import { FormOrderCancelButton, FormOrderSaveButton } from "@/components/forms";
import {
  DetailFieldCell,
  FORM_FIELD_READONLY_CLASS,
  FormDate,
  FormErrorSummary,
  FormNumber,
  FormSelect,
  FormText,
  FormTextarea,
  resolveNumericId,
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";
import {
  PARTE_DIARIO_DEFAULTS,
  getParteDiarioDetalleDefaults,
  parteDiarioSchema,
  VALIDATION_RULES,
  type ParteDiarioFormValues,
} from "./model";

type DetalleNominaEndpointRow = {
  idnomina?: number | string | null;
  horas?: number | string | null;
  idestado?: number | string | null;
  ingreso?: string | null;
  egreso?: string | null;
  descripcion?: string | null;
};

type DetallesNominaEndpointResponse =
  | DetalleNominaEndpointRow[]
  | {
      data?: DetalleNominaEndpointRow[];
      total?: number;
    };

const buildAuthHeaders = () => {
  const headers = new Headers({ Accept: "application/json" });
  if (typeof window === "undefined") return headers;

  const token = window.localStorage.getItem("auth_token");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};

const fetchJsonWithAuth = async <T,>(url: string): Promise<T> => {
  const { json } = await fetchUtils.fetchJson(url, {
    headers: buildAuthHeaders(),
  });
  return json as T;
};

const formatDateTimeInput = (date: Date | string | null | undefined) => {
  if (!date) return "";
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const ParteDiarioMainFields = () => (
  <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_130px_minmax(220px,0.9fr)] md:items-start">
    <ReferenceInput source="idproyecto" reference="proyectos" label="Proyecto">
      <FormSelect
        optionText="nombre"
        widthClass="w-full"
        emptyText="Seleccionar"
        validate={required()}
      />
    </ReferenceInput>
    <FormDate
      source="fecha"
      label="Fecha"
      validate={required()}
      widthClass="w-full md:w-[130px]"
    />
    <FormTextarea
      source="descripcion"
      label="Descripcion"
      widthClass="w-full"
      className="[&_textarea]:min-h-[38px] [&_textarea]:max-h-[56px]"
      maxLength={VALIDATION_RULES.DESCRIPCION.MAX_LENGTH}
    />
  </div>
);

const ParteDiarioDetalleFields = () => {
  const notify = useNotify();
  const proyectoValue = useWatch({ name: "idproyecto" });
  const { getValues, setValue } = useFormContext<ParteDiarioFormValues>();
  const [loadingNomina, setLoadingNomina] = useState(false);
  const [confirmCargarNomina, setConfirmCargarNomina] = useState(false);
  const columns: SectionDetailColumn[] = [
    { label: "Empleado", width: "minmax(170px,0.8fr)", mobileSpan: "full" },
    { label: "Horas", width: "72px" },
    { label: "Estado", width: "110px" },
    { label: "Ingreso", width: "136px" },
    { label: "Egreso", width: "136px" },
    { label: "Descripcion", width: "minmax(130px,0.7fr)", mobileSpan: "full" },
    { label: "Ausente", width: "54px" },
    { label: "", width: "minmax(54px,auto)" },
  ];

  const DetalleCamposPrincipales = useCallback(
    (props: SectionDetailFieldsProps) => <ParteDiarioDetalleMainFields {...props} />,
    [],
  );

  const handleCargarNomina = useCallback(async () => {
    const proyectoId = resolveNumericId(getValues("idproyecto") ?? proyectoValue);
    if (!proyectoId) {
      notify("Selecciona un proyecto antes de cargar la nomina.", {
        type: "warning",
      });
      return;
    }

    setLoadingNomina(true);
    try {
      const params = new URLSearchParams({ idproyecto: String(proyectoId) });
      const response = await fetchJsonWithAuth<DetallesNominaEndpointResponse>(
        `${apiUrl}/parte-diario/detalles-nomina?${params.toString()}`,
      );
      const empleados = Array.isArray(response) ? response : response.data ?? [];
      const currentValue = getValues("detalles");
      const current = Array.isArray(currentValue) ? currentValue : [];
      const empleadosActuales = new Set(
        current
          .map((detalle) => resolveNumericId(detalle?.idnomina))
          .filter((id): id is number => id != null),
      );
      const detallesParaAgregar: ParteDiarioFormValues["detalles"] = [];

      empleados.forEach((empleado) => {
        const idnomina = resolveNumericId(empleado.idnomina);
        if (!idnomina || empleadosActuales.has(idnomina)) return;

        const horas = Number(empleado.horas ?? 8);
        detallesParaAgregar.push({
          idnomina,
          horas: Number.isFinite(horas) ? horas : 8,
          idestado: resolveNumericId(empleado.idestado) ?? "",
          ingreso: empleado.ingreso ?? "",
          egreso: empleado.egreso ?? "",
          descripcion: empleado.descripcion ?? "",
        });
        empleadosActuales.add(idnomina);
      });

      if (!detallesParaAgregar.length) {
        notify(
          empleados.length
            ? "La nomina del proyecto ya estaba cargada."
            : "No hay empleados activos vinculados al proyecto.",
          { type: "info" },
        );
        return;
      }

      setValue("detalles", [...current, ...detallesParaAgregar], {
        shouldDirty: true,
        shouldValidate: true,
      });
      notify(`${detallesParaAgregar.length} empleados agregados al parte.`, {
        type: "success",
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "No se pudo cargar la nomina.",
        { type: "error" },
      );
    } finally {
      setLoadingNomina(false);
    }
  }, [getValues, notify, proyectoValue, setValue]);

  return (
    <>
      <SectionDetailTemplate2
        title="Detalle de horas"
        mainColumns={columns}
        mainFields={DetalleCamposPrincipales}
        defaults={getParteDiarioDetalleDefaults}
        maxHeightClassName="md:max-h-64"
        saveOnlyWhenActive
        showExpandActionOnMobile
        showExpandAction={false}
        showInfoAction={false}
        addButtonLabel="Agregar empleado"
        actions={
          <ParteDiarioCargarNominaAction
            loading={loadingNomina}
            onRequestConfirm={() => setConfirmCargarNomina(true)}
          />
        }
        detailIteratorClassName="[&_li]:!border-b [&_li]:!border-slate-200/70 [&_li:last-child]:!border-b-0"
      />
      <Confirm
        isOpen={confirmCargarNomina}
        loading={loadingNomina}
        title="Cargar nomina"
        content="Se agregaran al detalle los empleados activos del proyecto que todavia no estan cargados. Los registros existentes se mantienen."
        confirm="Cargar"
        cancel="Cancelar"
        overlayClassName="bg-transparent backdrop-blur-0"
        onClose={() => setConfirmCargarNomina(false)}
        onConfirm={() => {
          setConfirmCargarNomina(false);
          void handleCargarNomina();
        }}
      />
    </>
  );
};

const ParteDiarioCargarNominaAction = ({
  loading,
  onRequestConfirm,
}: {
  loading: boolean;
  onRequestConfirm: () => void;
}) => {
  return (
    <DropdownMenuItem
      className="gap-2 text-[9px] sm:text-[10px]"
      disabled={loading}
      onSelect={onRequestConfirm}
    >
      <UserPlus className="h-3 w-3" />
      {loading ? "Cargando..." : "Cargar"}
    </DropdownMenuItem>
  );
};

const ParteDiarioDetalleMainFields = ({ isActive }: SectionDetailFieldsProps) => {
  const descripcionSource = useWrappedSource("descripcion");
  const horasSource = useWrappedSource("horas");
  const descripcion = useWatch({ name: descripcionSource }) as string | undefined;
  const horas = useWatch({ name: horasSource }) as unknown;
  const { setValue } = useFormContext<ParteDiarioFormValues>();
  const hasDescripcion = Boolean(descripcion?.trim());
  const isAusente = Number(horas ?? 0) === 0;
  const readOnlyClassName = !isActive ? FORM_FIELD_READONLY_CLASS : undefined;

  const handleAusente = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setValue(horasSource as keyof ParteDiarioFormValues, (isAusente ? 8 : 0) as any, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <>
      <DetailFieldCell label="Empleado" data-focus-field="true">
        <ReferenceInput source="idnomina" reference="nominas">
          <FormSelect
            optionText="nombre"
            label={false}
            widthClass="w-full"
            emptyText="Seleccionar"
            validate={required()}
            className={readOnlyClassName}
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
            "gap-0 [&_input]:h-4.5 [&_input]:px-1 sm:[&_input]:h-5 sm:[&_input]:px-2",
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
          <FormSelect
            optionText="nombre"
            label={false}
            emptyText="Sin estado"
            widthClass="w-full"
            className={readOnlyClassName}
          />
        </ReferenceInput>
      </DetailFieldCell>
      <DetailFieldCell label="Ingreso">
        <FormText
          source="ingreso"
          label={false}
          type="datetime-local"
          format={formatDateTimeInput}
          widthClass="w-full"
          readOnly={!isActive}
          className={cn("gap-0 [&_input]:h-5 [&_input]:px-1", readOnlyClassName)}
        />
      </DetailFieldCell>
      <DetailFieldCell label="Egreso">
        <FormText
          source="egreso"
          label={false}
          type="datetime-local"
          format={formatDateTimeInput}
          widthClass="w-full"
          readOnly={!isActive}
          className={cn("gap-0 [&_input]:h-5 [&_input]:px-1", readOnlyClassName)}
        />
      </DetailFieldCell>
      <DetailFieldCell
        label="Descripcion"
        className={cn(!hasDescripcion && "hidden sm:flex")}
      >
        <FormText
          source="descripcion"
          label={false}
          placeholder="Tareas realizadas o nota"
          widthClass="w-full"
          readOnly={!isActive}
          maxLength={VALIDATION_RULES.DETALLE_DESCRIPCION.MAX_LENGTH}
          className={readOnlyClassName}
        />
      </DetailFieldCell>
      <DetailFieldCell label="Ausente" className="items-center justify-center">
        <button
          type="button"
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-md transition",
            isAusente
              ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          onClick={handleAusente}
          aria-label={isAusente ? "Asignar 8 horas" : "Marcar ausente"}
          title={isAusente ? "Asignar 8 horas" : "Marcar ausente"}
          tabIndex={-1}
        >
          <UserX className="h-3 w-3" />
        </button>
      </DetailFieldCell>
    </>
  );
};

const ParteDiarioToolbar = () => (
  <div className="flex w-full items-center justify-end gap-2">
    <FormOrderCancelButton />
    <FormOrderSaveButton variant="secondary" />
  </div>
);

const ParteDiarioResumenTotales = () => {
  const detalles = useWatch({ name: "detalles" }) as
    | Array<{ idnomina?: unknown; horas?: unknown }>
    | undefined;
  const lineasConEmpleado = (detalles ?? []).filter(
    (detalle) => detalle?.idnomina != null && detalle.idnomina !== "",
  );
  const cantidadEmpleados = lineasConEmpleado.length;
  const totalHoras = lineasConEmpleado.reduce((total, detalle) => {
    const horas = Number(detalle.horas ?? 0);
    return total + (Number.isFinite(horas) ? horas : 0);
  }, 0);
  const cantidadAusencias = lineasConEmpleado.filter((detalle) => {
    const horas = Number(detalle.horas ?? 0);
    return Number.isFinite(horas) && horas === 0;
  }).length;

  return (
    <div className="flex flex-row flex-nowrap items-center justify-start gap-2 rounded-md border border-muted/60 bg-muted/30 px-2 py-1 text-[8px] text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:px-3 sm:py-2 sm:text-[10px]">
      <span className="flex items-center gap-1.5 rounded-full bg-foreground/90 px-2 py-0.5 text-[8px] font-semibold text-background whitespace-nowrap sm:px-2.5 sm:py-1 sm:text-[10px]">
        Empleados: {cantidadEmpleados}
      </span>
      <span className="flex items-center gap-1.5 rounded-full bg-foreground/90 px-2 py-0.5 text-[8px] font-semibold text-background whitespace-nowrap sm:px-2.5 sm:py-1 sm:text-[10px]">
        Horas: {totalHoras.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
      </span>
      <span className="flex items-center gap-1.5 rounded-full bg-foreground/90 px-2 py-0.5 text-[8px] font-semibold text-background whitespace-nowrap sm:px-2.5 sm:py-1 sm:text-[10px]">
        Ausencias: {cantidadAusencias}
      </span>
    </div>
  );
};

export const ParteDiarioForm = () => (
  <SimpleForm<ParteDiarioFormValues>
    className="w-full max-w-5xl"
    resolver={zodResolver(parteDiarioSchema) as any}
    toolbar={<ParteDiarioToolbar />}
    defaultValues={PARTE_DIARIO_DEFAULTS}
  >
    <FormErrorSummary />
    <SectionBaseTemplate
      title="Informacion general"
      main={<ParteDiarioMainFields />}
      defaultOpen
    />
    <ParteDiarioDetalleFields />
    <ParteDiarioResumenTotales />
  </SimpleForm>
);
