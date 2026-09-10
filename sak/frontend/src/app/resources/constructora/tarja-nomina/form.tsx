"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required, useGetOne, useRecordContext } from "ra-core";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { FormOrderToolbar } from "@/components/forms";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { NominaQuickCreateDialog } from "./nomina-quick-create-dialog";
import {
  FormBoolean,
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormTextarea,
  FormValue,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import {
  TARJA_NOMINA_DEFAULT,
  VALIDATION_RULES,
  tarjaNominaSchema,
  type TarjaNominaFormValues,
} from "./model";

const LockedReferenceValue = ({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: ReactNode;
  secondary?: ReactNode;
}) => (
  <div className="rounded-md border bg-muted/30 px-2 py-1">
    <div className="text-[9px] font-semibold leading-none text-muted-foreground sm:text-[10px]">
      {label}
    </div>
    <div className="mt-0.5 text-[10px] font-medium leading-tight text-foreground">
      {primary}
    </div>
    {secondary ? (
      <div className="text-[9px] leading-tight text-muted-foreground">
        {secondary}
      </div>
    ) : null}
  </div>
);

const toAmount = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const toOptionalId = (value: unknown) => {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : undefined;
};

const formatMoney = (value: number) =>
  value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatHoursValue = (value: number) =>
  value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDateValue = (value?: string | null) => {
  const [year, month, day] = String(value ?? "").slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "-";
};

const getEmpleadoLabel = (choice?: unknown) => {
  if (!choice || typeof choice !== "object") return "";
  const record = choice as {
    apellido?: string | null;
    nombre?: string | null;
    dni?: string | null;
  };
  const nombre = [record.apellido, record.nombre].filter(Boolean).join(", ");
  return [nombre, record.dni].filter(Boolean).join(" - ");
};

const ReadOnlyNumber = ({
  label,
  value,
  strong = false,
  className,
}: {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
}) => (
  <FormValue
    label={label}
    widthClass="w-full"
    className={className}
    valueClassName={`justify-end bg-muted/30 tabular-nums text-muted-foreground ${strong ? "font-semibold text-foreground" : ""}`}
  >
    {value}
  </FormValue>
);

type EmpleadoReference = {
  id: number | string;
  apellido?: string | null;
  nombre?: string | null;
  nombre_completo?: string | null;
  dni?: string | null;
  nomina_categoria_id?: number | null;
  nomina_tarea_id?: number | null;
  idproyecto?: number | null;
  encargado_contacto_id?: number | null;
};

const TarjaNominaHeaderFields = ({
  lockTarja = false,
  lockEmpleado = false,
  defaultValues,
  empleadoLabel,
  obraLabel,
  encargadoId,
  encargadoLabel,
  isCreate = false,
}: {
  lockTarja?: boolean;
  lockEmpleado?: boolean;
  defaultValues?: Partial<TarjaNominaFormValues>;
  empleadoLabel?: string;
  obraLabel?: string;
  encargadoId?: number;
  encargadoLabel?: string;
  isCreate?: boolean;
}) => {
  const { setValue } = useFormContext<TarjaNominaFormValues>();
  const fechaIngreso = useWatch({ name: "fecha_desde" });
  const fechaEgreso = useWatch({ name: "fecha_hasta" });
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const handleEmpleadoCreated = (record: EmpleadoReference) => {
    setValue("nomina_id", Number(record.id), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("nomina_categoria_id", record.nomina_categoria_id ?? undefined, {
      shouldDirty: true,
    });
    setValue("nomina_tarea_id", record.nomina_tarea_id ?? undefined, {
      shouldDirty: true,
    });
    setQuickCreateOpen(false);
  };

  const empleadoFieldLabel = (
    <span className="inline-flex items-center gap-1">
      <span>Empleado</span>
      {isCreate ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-5"
          title="Agregar empleado"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setQuickCreateOpen(true);
          }}
        >
          <Plus className="size-3.5" />
          <span className="sr-only">Agregar empleado</span>
        </Button>
      ) : null}
    </span>
  );

  return <>
    {lockTarja ? <HiddenInput source="tarja_id" /> : null}
    {lockEmpleado ? <HiddenInput source="nomina_id" /> : null}
    <HiddenInput source="confirmar_traspaso" />
    <div className="grid gap-1.5 md:grid-cols-3">
      {lockTarja ? (
        <LockedReferenceValue
          label="Tarja"
          primary={defaultValues?.tarja_id ? `#${defaultValues.tarja_id}` : "-"}
          secondary={obraLabel || undefined}
        />
      ) : (
        <FormReferenceAutocomplete
          referenceProps={{ source: "tarja_id", reference: "tarjas" }}
          inputProps={{
            optionText: "descripcion",
            label: "Tarja",
            validate: required(),
          }}
          widthClass="w-full"
        />
      )}
      <LockedReferenceValue
        label="Encargado"
        primary={encargadoLabel || encargadoId || "-"}
        secondary={encargadoId ? `ID contacto ${encargadoId}` : undefined}
      />
      {lockEmpleado ? (
        <LockedReferenceValue
          label="Empleado"
          primary={empleadoLabel || defaultValues?.nomina_id || "-"}
          secondary={
            defaultValues?.nomina_id
              ? `ID nomina ${defaultValues.nomina_id}`
              : undefined
          }
        />
      ) : (
        <FormReferenceAutocomplete
          referenceProps={{
            source: "nomina_id",
            reference: "nominas",
            filter: {
              activo: true,
              idproyecto: null,
            },
            sort: { field: "apellido", order: "ASC" },
          }}
          inputProps={{
            optionText: getEmpleadoLabel,
            inputText: getEmpleadoLabel,
            label: empleadoFieldLabel,
            placeholder: "Seleccionar",
            validate: required(),
          }}
          widthClass="w-full"
        />
      )}
    </div>
    <HiddenInput source="fecha_hasta" />
    <HiddenInput source="tarja_fecha_desde" />
    <HiddenInput source="tarja_fecha_hasta" />
    <div className="mt-1.5 grid gap-1.5 md:grid-cols-3">
      {isCreate ? (
        <FormDate
          source="fecha_desde"
          label="Fecha de ingreso"
          widthClass="w-full"
        />
      ) : (
        <>
          <HiddenInput source="fecha_desde" />
          <LockedReferenceValue
            label="Fecha de ingreso"
            primary={formatDateValue(fechaIngreso)}
          />
        </>
      )}
      <LockedReferenceValue
        label="Fecha de egreso"
        primary={formatDateValue(fechaEgreso)}
      />
    </div>
    <NominaQuickCreateDialog
      open={quickCreateOpen}
      onClose={() => setQuickCreateOpen(false)}
      onCreated={handleEmpleadoCreated}
    />
  </>
};

const SelectedEmpleadoDefaults = () => {
  const { setValue } = useFormContext<TarjaNominaFormValues>();
  const nominaId = Number(useWatch({ name: "nomina_id" }));
  const previousNominaId = useRef<number | undefined>(undefined);
  const { data: empleado } = useGetOne<EmpleadoReference>(
    "nominas",
    { id: nominaId },
    { enabled: Number.isFinite(nominaId) && nominaId > 0 },
  );

  useEffect(() => {
    if (!empleado || previousNominaId.current === nominaId) return;
    previousNominaId.current = nominaId;
    setValue("nomina_categoria_id", empleado.nomina_categoria_id ?? undefined, {
      shouldDirty: false,
    });
    setValue("nomina_tarea_id", empleado.nomina_tarea_id ?? undefined, {
      shouldDirty: false,
    });
  }, [empleado, nominaId, setValue]);

  return null;
};

const TarjaNominaFields = ({
  empleadoCategoriaId,
  empleadoTareaId,
  horasTrabajadas = 0,
}: {
  empleadoCategoriaId?: number | null;
  empleadoTareaId?: number | null;
  horasTrabajadas?: number;
}) => {
  const { setValue } = useFormContext<TarjaNominaFormValues>();
  const categoriaValue = useWatch({ name: "nomina_categoria_id" });
  const tareaValue = useWatch({ name: "nomina_tarea_id" });
  const horasJustificadas = useWatch({ name: "horas_justificadas" });
  const horasTrabajadasValue = toAmount(horasTrabajadas);
  const horasTotales = horasTrabajadasValue + toAmount(horasJustificadas);

  useEffect(() => {
    if (!categoriaValue && empleadoCategoriaId) {
      setValue("nomina_categoria_id", empleadoCategoriaId, { shouldDirty: false });
    }
  }, [categoriaValue, empleadoCategoriaId, setValue]);

  useEffect(() => {
    if (!tareaValue && empleadoTareaId) {
      setValue("nomina_tarea_id", empleadoTareaId, { shouldDirty: false });
    }
  }, [empleadoTareaId, setValue, tareaValue]);

  return (
    <div className="grid gap-2 md:grid-cols-2">
      <FormReferenceAutocomplete
        referenceProps={{
          source: "nomina_categoria_id",
          reference: "nomina-categorias",
          filter: { activa: true },
        }}
        inputProps={{
          optionText: "descripcion",
          label: "Categoria",
          placeholder: "Seleccionar",
        }}
        widthClass="w-full"
      />
      <FormReferenceAutocomplete
        referenceProps={{
          source: "nomina_tarea_id",
          reference: "nomina-tareas",
          filter: { activa: true },
        }}
        inputProps={{
          optionText: "descripcion",
          label: "Actividad",
          placeholder: "Seleccionar",
        }}
        widthClass="w-full"
      />
      <div className="grid gap-2 md:col-span-2 md:grid-cols-4">
        <ReadOnlyNumber
          label="Horas Trabajadas"
          value={formatHoursValue(horasTrabajadasValue)}
        />
        <FormNumber
          source="horas_justificadas"
          label="Horas Justificadas"
          min={0}
          step="0.01"
          widthClass="w-full"
        />
        <ReadOnlyNumber
          label="Horas Totales"
          value={formatHoursValue(horasTotales)}
        />
        <FormNumber
          source="adicional_importe"
          label="Adicional"
          min={0}
          step="0.01"
          widthClass="w-full"
        />
      </div>
      <div className="grid gap-2 md:col-span-2 md:grid-cols-3">
        <div className="flex items-end">
          <FormBoolean source="presentismo" label="Presentismo" />
        </div>
        <div className="flex items-end">
          <FormBoolean source="viatico" label="Viatico" />
        </div>
        <div className="flex items-end">
          <FormBoolean source="premio" label="Premio" />
        </div>
      </div>
      <FormTextarea
        source="observaciones"
        label="Observaciones"
        rows={3}
        widthClass="w-full"
        className="md:col-span-2 [&_textarea]:min-h-[72px]"
        maxLength={VALIDATION_RULES.OBSERVACIONES.MAX_LENGTH}
      />
    </div>
  );
};

const TransferAwareToolbar = ({
  proyectoId,
  encargadoId,
  returnTo,
  saveDisabled = false,
}: {
  proyectoId?: number;
  encargadoId?: number;
  returnTo?: string | null;
  saveDisabled?: boolean;
}) => {
  const navigate = useNavigate();
  const { setValue } = useFormContext<TarjaNominaFormValues>();
  const nominaId = useWatch({ name: "nomina_id" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);
  const { data: empleado, isPending: empleadoPending } = useGetOne<EmpleadoReference>(
    "nominas",
    { id: Number(nominaId) },
    { enabled: Number.isFinite(Number(nominaId)) && Number(nominaId) > 0 },
  );
  const requiereTraspaso = Boolean(
    empleado &&
      ((empleado.idproyecto != null && empleado.idproyecto !== proyectoId) ||
        (empleado.encargado_contacto_id != null &&
          empleado.encargado_contacto_id !== encargadoId)),
  );

  useEffect(() => {
    if (!requiereTraspaso) {
      setValue("confirmar_traspaso", false, { shouldDirty: false });
    }
  }, [requiereTraspaso, setValue]);

  const handleSaveClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (saveDisabled) {
      event.preventDefault();
      return;
    }
    if (!requiereTraspaso) return;
    event.preventDefault();
    setFormElement(event.currentTarget.form);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setValue("confirmar_traspaso", true, { shouldDirty: true });
    setConfirmOpen(false);
    queueMicrotask(() => formElement?.requestSubmit());
  };

  return (
    <>
      <FormOrderToolbar
        cancelProps={
          returnTo
            ? {
                onClick: () => navigate(returnTo),
              }
            : undefined
        }
        saveProps={{
          onClick: handleSaveClick,
          disabled: saveDisabled || (Boolean(nominaId) && empleadoPending),
        }}
      />
      <Confirm
        isOpen={confirmOpen}
        title="Confirmar traspaso"
        content="El empleado pertenece a otra nomina. Se registrara la baja el dia anterior y el alta en la nomina actual."
        confirm="Traspasar"
        cancel="Cancelar"
        confirmColor="warning"
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
};

const TarjaLiquidacionFields = () => {
  const [
    presentismoImporte,
    premioImporte,
    viaticoImporte,
    sueldoImporte,
    cargasImporte,
    mejoraImporte,
    adicionalImporte,
  ] = useWatch<TarjaNominaFormValues>({
    name: [
      "presentismo_importe",
      "premio_importe",
      "viatico_importe",
      "sueldo_importe",
      "cargas_importe",
      "mejora_importe",
      "adicional_importe",
    ],
  });

  const total =
    toAmount(presentismoImporte) +
    toAmount(premioImporte) +
    toAmount(viaticoImporte) +
    toAmount(sueldoImporte) +
    toAmount(cargasImporte) +
    toAmount(mejoraImporte) +
    toAmount(adicionalImporte);

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 md:grid-cols-3">
        <ReadOnlyNumber
          label="Presentismo"
          value={formatMoney(toAmount(presentismoImporte))}
        />
        <ReadOnlyNumber
          label="Sueldo"
          value={formatMoney(toAmount(sueldoImporte))}
        />
        <ReadOnlyNumber
          label="Cargas"
          value={formatMoney(toAmount(cargasImporte))}
        />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <ReadOnlyNumber
          label="Adicional"
          value={formatMoney(toAmount(adicionalImporte))}
        />
        <ReadOnlyNumber
          label="Viatico"
          value={formatMoney(toAmount(viaticoImporte))}
        />
        <ReadOnlyNumber
          label="Premio"
          value={formatMoney(toAmount(premioImporte))}
        />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <ReadOnlyNumber
          label="Mejoras"
          value={formatMoney(toAmount(mejoraImporte))}
        />
        <ReadOnlyNumber
          label="Total"
          value={formatMoney(total)}
          strong
        />
      </div>
    </div>
  );
};

type TarjaNominaFormProps = {
  defaultValues?: Partial<TarjaNominaFormValues>;
  lockReferences?: boolean;
};

export const TarjaNominaForm = ({
  defaultValues,
  lockReferences = false,
}: TarjaNominaFormProps = {}) => {
  const location = useLocation();
  const record = useRecordContext<
    Partial<TarjaNominaFormValues> & {
      id?: number | string;
      empleado?: string | null;
      obra?: string | null;
      encargado?: string | null;
      proyecto_id?: number | null;
      encargado_id?: number | null;
      tipo_novedad?: string | null;
      editable?: boolean | null;
    }
  >();
  const params = new URLSearchParams(location.search);
  const effectiveValues = {
    ...TARJA_NOMINA_DEFAULT,
    ...record,
    ...(defaultValues ?? {}),
  };
  const lockTarja = lockReferences || Boolean(effectiveValues.tarja_id);
  const lockEmpleado = Boolean(effectiveValues.nomina_id);
  const proyectoId =
    toOptionalId(params.get("proyecto_id")) ??
    toOptionalId(record?.proyecto_id);
  const encargadoId =
    toOptionalId(params.get("encargado_id")) ??
    toOptionalId(record?.encargado_id);
  const obraLabel = params.get("obra") || record?.obra || undefined;
  const encargadoLabelFromContext =
    params.get("encargado") || record?.encargado || undefined;
  const nominaId =
    effectiveValues.nomina_id == null ? undefined : Number(effectiveValues.nomina_id);
  const { data: empleado } = useGetOne<{
    id: number | string;
    apellido?: string | null;
    nombre?: string | null;
    nombre_completo?: string | null;
    dni?: string | null;
    nomina_categoria_id?: number | null;
    nomina_tarea_id?: number | null;
  }>(
    "nominas",
    { id: nominaId as number },
    { enabled: Number.isFinite(nominaId) && Boolean(nominaId) },
  );
  const empleadoLabel =
    empleado?.nombre_completo ||
    (empleado ? getEmpleadoLabel(empleado) : record?.empleado || "");
  const { data: proyecto } = useGetOne<{
    id: number | string;
    nombre?: string | null;
  }>(
    "proyectos",
    { id: proyectoId as number },
    {
      enabled:
        Number.isFinite(proyectoId) && Boolean(proyectoId) && !obraLabel,
    },
  );
  const resolvedObraLabel = obraLabel || proyecto?.nombre || "";
  const { data: encargado } = useGetOne<{
    id: number | string;
    nombre_completo?: string | null;
    nombre?: string | null;
  }>(
    "crm/contactos",
    { id: encargadoId as number },
    {
      enabled:
        Number.isFinite(encargadoId) &&
        Boolean(encargadoId) &&
        !encargadoLabelFromContext,
    },
  );
  const encargadoLabel =
    encargadoLabelFromContext ||
    encargado?.nombre_completo ||
    encargado?.nombre ||
    "";
  const returnTo = params.get("returnTo");
  const horasTrabajadasParam = params.get("horas_trabajadas");
  const horasTrabajadas = toAmount(horasTrabajadasParam);
  const isCreate = !record?.id;
  const isReadOnlyNovedad =
    record?.editable === false || record?.tipo_novedad === "ALT";

  return (
    <SimpleForm<TarjaNominaFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(tarjaNominaSchema) as any}
      toolbar={
        <TransferAwareToolbar
          proyectoId={proyectoId}
          encargadoId={encargadoId}
          returnTo={returnTo}
          saveDisabled={isReadOnlyNovedad}
        />
      }
      defaultValues={effectiveValues}
    >
      <SelectedEmpleadoDefaults />
      <SectionBaseTemplate
        title="Cabecera"
        main={
          <TarjaNominaHeaderFields
            lockTarja={lockTarja}
            lockEmpleado={lockEmpleado}
            defaultValues={effectiveValues}
            empleadoLabel={empleadoLabel}
            obraLabel={resolvedObraLabel}
            encargadoId={encargadoId}
            encargadoLabel={encargadoLabel}
            isCreate={isCreate}
          />
        }
        defaultOpen
      />
      <SectionBaseTemplate
        title="Datos de nomina"
        main={
          <TarjaNominaFields
            empleadoCategoriaId={empleado?.nomina_categoria_id}
            empleadoTareaId={empleado?.nomina_tarea_id}
            horasTrabajadas={horasTrabajadas}
          />
        }
        defaultOpen
      />
      <SectionBaseTemplate
        title="Liquidacion"
        main={<TarjaLiquidacionFields />}
        defaultOpen={false}
      />
    </SimpleForm>
  );
};
