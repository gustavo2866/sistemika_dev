"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required, useGetOne, useRecordContext } from "ra-core";
import { useEffect, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { FormOrderToolbar } from "@/components/forms";
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
  TARJA_NOVEDAD_DEFAULT,
  VALIDATION_RULES,
  tarjaNovedadSchema,
  type TarjaNovedadFormValues,
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
  <div className="rounded-md border bg-muted/30 px-3 py-2">
    <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
    <div className="text-sm font-medium text-foreground">{primary}</div>
    {secondary ? <div className="text-[11px] text-muted-foreground">{secondary}</div> : null}
  </div>
);

const toAmount = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
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

const TarjaNovedadFields = ({
  lockReferences = false,
  defaultValues,
  empleadoLabel,
  empleadoCategoriaId,
  empleadoTareaId,
  horasTrabajadas = 0,
}: {
  lockReferences?: boolean;
  defaultValues?: Partial<TarjaNovedadFormValues>;
  empleadoLabel?: string;
  empleadoCategoriaId?: number | null;
  empleadoTareaId?: number | null;
  horasTrabajadas?: number;
}) => {
  const { setValue } = useFormContext<TarjaNovedadFormValues>();
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
      <HiddenInput source="nomina_id" />
      {lockReferences ? (
        <>
          <HiddenInput source="tarja_id" />
          <LockedReferenceValue label="Tarja" primary={defaultValues?.tarja_id ?? "-"} />
          <LockedReferenceValue
            label="Empleado"
            primary={empleadoLabel || defaultValues?.nomina_id || "-"}
            secondary={defaultValues?.nomina_id ? `ID nomina ${defaultValues.nomina_id}` : undefined}
          />
        </>
      ) : (
        <>
          <FormReferenceAutocomplete
            referenceProps={{ source: "tarja_id", reference: "tarjas" }}
            inputProps={{
              optionText: "descripcion",
              label: "Tarja",
              validate: required(),
            }}
            widthClass="w-full"
          />
        </>
      )}
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
      {lockReferences ? (
        <>
          <HiddenInput source="fecha_desde" />
          <HiddenInput source="fecha_hasta" />
        </>
      ) : (
        <>
          <FormDate source="fecha_desde" label="Fecha desde" widthClass="w-full" />
          <FormDate source="fecha_hasta" label="Fecha hasta" widthClass="w-full" />
        </>
      )}
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

const TarjaLiquidacionFields = () => {
  const [
    presentismoImporte,
    premioImporte,
    viaticoImporte,
    sueldoImporte,
    cargasImporte,
    mejoraImporte,
    adicionalImporte,
  ] = useWatch<TarjaNovedadFormValues>({
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

type TarjaNovedadFormProps = {
  defaultValues?: Partial<TarjaNovedadFormValues>;
  lockReferences?: boolean;
};

export const TarjaNovedadForm = ({
  defaultValues,
  lockReferences = false,
}: TarjaNovedadFormProps = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const record = useRecordContext<Partial<TarjaNovedadFormValues>>();
  const effectiveValues = {
    ...TARJA_NOVEDAD_DEFAULT,
    ...record,
    ...(defaultValues ?? {}),
  };
  const effectiveLockReferences =
    lockReferences || Boolean(effectiveValues.tarja_id && effectiveValues.nomina_id);
  const nominaId =
    effectiveValues.nomina_id == null ? undefined : Number(effectiveValues.nomina_id);
  const { data: empleado } = useGetOne<{
    id: number | string;
    apellido?: string | null;
    nombre?: string | null;
    nombre_completo?: string | null;
    nomina_categoria_id?: number | null;
    nomina_tarea_id?: number | null;
  }>(
    "nominas",
    { id: nominaId as number },
    { enabled: Number.isFinite(nominaId) && Boolean(nominaId) },
  );
  const empleadoLabel =
    empleado?.nombre_completo ||
    [empleado?.apellido, empleado?.nombre].filter(Boolean).join(", ");
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");
  const horasTrabajadasParam = params.get("horas_trabajadas");
  const horasTrabajadas = toAmount(horasTrabajadasParam);
  const isReadOnlyNovedad =
    (effectiveValues as { tipo_novedad?: string | null; editable?: boolean | null })
      .editable === false ||
    (effectiveValues as { tipo_novedad?: string | null }).tipo_novedad === "ALT";

  return (
    <SimpleForm<TarjaNovedadFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(tarjaNovedadSchema) as any}
      toolbar={
        <FormOrderToolbar
          cancelProps={
            returnTo
              ? {
                  onClick: () => navigate(returnTo),
                }
              : undefined
          }
          saveProps={isReadOnlyNovedad ? { disabled: true } : undefined}
        />
      }
      defaultValues={effectiveValues}
    >
      <SectionBaseTemplate
        title="Datos de nomina"
        main={
          <TarjaNovedadFields
            lockReferences={effectiveLockReferences}
            defaultValues={effectiveValues}
            empleadoLabel={empleadoLabel}
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
        defaultOpen
      />
    </SimpleForm>
  );
};
