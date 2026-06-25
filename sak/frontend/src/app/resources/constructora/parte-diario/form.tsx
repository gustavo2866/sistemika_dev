"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { fetchUtils, required, useNotify, useWrappedSource } from "ra-core";
import { useCallback, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { PlusCircle, UserPlus } from "lucide-react";
import { Confirm } from "@/components/confirm";
import { FormOrderCancelButton, FormOrderSaveButton } from "@/components/forms";
import {
  DetailFieldCell,
  FORM_FIELD_READONLY_CLASS,
  FormDate,
  FormErrorSummary,
  FormReferenceAutocomplete,
  FormNumber,
  FormSelect,
  FormSelectFijo,
  FormText,
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

const getNominaLabel = (record?: Record<string, unknown>) => {
  if (!record) return "";
  const proyecto = record.proyecto as { nombre?: string | null } | null | undefined;
  const nombre = [record.nombre, record.apellido]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .trim();
  const empleado = nombre || (typeof record.dni === "string" ? record.dni : "");
  const obra = proyecto?.nombre?.trim().slice(0, 5);
  return obra ? `${empleado} (${obra})` : empleado;
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
    <FormText
      source="descripcion"
      label="Descripcion"
      widthClass="w-full"
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
  const [addRequestSignal, setAddRequestSignal] = useState(0);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const columns: SectionDetailColumn[] = [
    { label: "Empleado", width: "180px", mobileSpan: "full" },
    { label: "Horas", width: "54px" },
    { label: "Estado", width: "122px" },
    { label: "Descripcion", width: "minmax(150px,1fr)", mobileSpan: "full" },
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
          idestado: resolveNumericId(empleado.idestado),
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
    <div className="flex flex-col gap-0">
      <SectionDetailTemplate2
        title="Detalle de horas"
        mainColumns={columns}
        mainFields={DetalleCamposPrincipales}
        defaults={getParteDiarioDetalleDefaults}
        maxHeightClassName="md:h-36 md:min-h-36 md:max-h-36"
        saveOnlyWhenActive
        showDeleteWhenInactive
        showExpandActionOnMobile
        showExpandAction={false}
        showInfoAction={false}
        addButtonLabel="Agregar novedad"
        addRequestSignal={addRequestSignal}
        hideFooterAddButton
        onActiveRowChange={setActiveRowIndex}
        cardClassName="pb-0"
        detailContainerClassName="px-1 pb-0"
        actions={
          <ParteDiarioCargarNominaAction
            loading={loadingNomina}
            onRequestConfirm={() => setConfirmCargarNomina(true)}
          />
        }
        detailIteratorClassName={
          "[&_li]:!border-b [&_li]:!border-slate-200/70 [&_li:last-child]:!border-b-0 " +
          "[&_li]:!min-h-0 [&_li]:!py-0 " +
          "[&_[data-focus-scope=detail-row]]:text-[8px] " +
          "[&_[data-focus-scope=detail-row]]:sm:text-[9px] " +
          "[&_[data-focus-scope=detail-row]]:!py-0 " +
          "[&_[data-focus-scope=detail-row]>div]:!gap-0.5 " +
          "[&_[data-focus-scope=detail-row]>div>div]:sm:!gap-1 " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!border-0 " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!ring-1 " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!ring-inset " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!ring-primary/30 " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!p-0.5 " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!py-[3px]"
        }
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
      <ParteDiarioResumenTotales
        addDisabled={activeRowIndex != null}
        onAdd={() => setAddRequestSignal((current) => current + 1)}
      />
    </div>
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
  const [buscarTodaNomina, setBuscarTodaNomina] = useState(false);
  const descripcionSource = useWrappedSource("descripcion");
  const descripcion = useWatch({ name: descripcionSource }) as string | undefined;
  const proyectoValue = useWatch({ name: "idproyecto" });
  const proyectoId = resolveNumericId(proyectoValue);
  const hasDescripcion = Boolean(descripcion?.trim());
  const readOnlyClassName = !isActive ? FORM_FIELD_READONLY_CLASS : undefined;
  const nominaFilter = {
    activo: true,
    ...(!buscarTodaNomina && proyectoId ? { idproyecto: proyectoId } : {}),
  };

  return (
    <>
      <DetailFieldCell label="Empleado" data-focus-field="true">
        <div className="flex w-[180px] items-center gap-1">
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
            widthClass={isActive ? "w-[144px]" : "w-[180px]"}
            className={cn(
              "[&_button[role=combobox]]:h-3.5 [&_button[role=combobox]]:px-0.5 [&_button[role=combobox]]:py-0 [&_button[role=combobox]]:text-[8px] " +
                "sm:[&_button[role=combobox]]:h-4 sm:[&_button[role=combobox]]:px-1 sm:[&_button[role=combobox]]:text-[9px] " +
                "[&_button[role=combobox]>span]:text-[8px] sm:[&_button[role=combobox]>span]:text-[9px]",
              readOnlyClassName,
            )}
          />
          {isActive ? (
            <button
              type="button"
              aria-pressed={buscarTodaNomina}
              title="Buscar empleados de todas las obras"
              className={cn(
                "h-4 w-7 shrink-0 rounded border px-0.5 text-[6px] font-medium leading-none transition-colors",
                buscarTodaNomina
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
              )}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setBuscarTodaNomina((current) => !current);
              }}
            >
              Todas
            </button>
          ) : null}
        </div>
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
            "gap-0 [&_input]:h-3.5 [&_input]:px-0.5 [&_input]:text-[8px] sm:[&_input]:h-4 sm:[&_input]:px-1 sm:[&_input]:text-[9px]",
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
              style: {
                height: "16px",
                minHeight: "16px",
                maxHeight: "16px",
                paddingTop: 0,
                paddingBottom: 0,
              },
              className:
                "px-0.5 text-left text-[8px] whitespace-nowrap sm:px-1 sm:text-[9px] " +
                "[&_svg]:size-2.5 " +
                "*:data-[slot=select-value]:line-clamp-1 " +
                "*:data-[slot=select-value]:truncate " +
                "*:data-[slot=select-value]:whitespace-nowrap " +
                "*:data-[slot=select-value]:leading-none",
            }}
          />
        </ReferenceInput>
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
          className={cn(
            "[&_input]:h-3.5 [&_input]:px-0.5 [&_input]:text-[8px] sm:[&_input]:h-4 sm:[&_input]:px-1 sm:[&_input]:text-[9px]",
            readOnlyClassName,
          )}
        />
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

const ParteDiarioResumenTotales = ({
  addDisabled,
  onAdd,
}: {
  addDisabled: boolean;
  onAdd: () => void;
}) => {
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
    <div className="flex flex-row flex-nowrap items-center justify-between gap-1.5 rounded-md border border-muted/50 bg-muted/15 px-2 py-0.5 text-[8px] text-muted-foreground sm:gap-2 sm:px-2.5 sm:py-1 sm:text-[9px]">
      <button
        type="button"
        className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md border border-blue-300 bg-white px-1.5 text-[8px] font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-[9px]"
        disabled={addDisabled}
        onClick={onAdd}
      >
        <PlusCircle className="size-3" />
        Agregar novedad
      </button>
      <div className="flex flex-row flex-nowrap items-center justify-end gap-1.5 sm:gap-2">
        <span className="flex items-center gap-1 rounded-full border border-muted-foreground/15 bg-background px-1.5 py-0 text-[8px] font-medium text-muted-foreground whitespace-nowrap sm:px-2 sm:text-[9px]">
          Empleados: {cantidadEmpleados}
        </span>
        <span className="flex items-center gap-1 rounded-full border border-muted-foreground/15 bg-background px-1.5 py-0 text-[8px] font-medium text-muted-foreground whitespace-nowrap sm:px-2 sm:text-[9px]">
          Horas: {totalHoras.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
        </span>
        <span className="flex items-center gap-1 rounded-full border border-muted-foreground/15 bg-background px-1.5 py-0 text-[8px] font-medium text-muted-foreground whitespace-nowrap sm:px-2 sm:text-[9px]">
          Ausencias: {cantidadAusencias}
        </span>
      </div>
    </div>
  );
};

export const ParteDiarioForm = ({
  defaultValues = PARTE_DIARIO_DEFAULTS,
}: {
  defaultValues?: Partial<ParteDiarioFormValues>;
} = {}) => (
  <SimpleForm<ParteDiarioFormValues>
    className="w-full max-w-5xl"
    resolver={zodResolver(parteDiarioSchema) as any}
    toolbar={<ParteDiarioToolbar />}
    defaultValues={{ ...PARTE_DIARIO_DEFAULTS, ...defaultValues }}
  >
    <FormErrorSummary />
    <SectionBaseTemplate
      title="Informacion general"
      main={<ParteDiarioMainFields />}
      defaultOpen
    />
    <ParteDiarioDetalleFields />
  </SimpleForm>
);
