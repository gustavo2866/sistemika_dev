"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required, useGetOne, useRecordContext } from "ra-core";
import { useEffect, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormNumber,
  FormReferenceAutocomplete,
  FormTextarea,
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

const TarjaNovedadFields = ({
  lockReferences = false,
  defaultValues,
  empleadoLabel,
  empleadoCategoriaId,
  empleadoTareaId,
}: {
  lockReferences?: boolean;
  defaultValues?: Partial<TarjaNovedadFormValues>;
  empleadoLabel?: string;
  empleadoCategoriaId?: number | null;
  empleadoTareaId?: number | null;
}) => {
  const { setValue } = useFormContext<TarjaNovedadFormValues>();
  const categoriaValue = useWatch({ name: "nomina_categoria_id" });
  const tareaValue = useWatch({ name: "nomina_tarea_id" });

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
      <FormNumber
        source="horas_justificadas"
        label="Horas justificadas"
        min={0}
        step="0.01"
        widthClass="w-full"
      />
      <div className="flex items-end">
        <FormBoolean source="presentismo" label="Presentismo" />
      </div>
      <FormNumber
        source="adicional"
        label="Adicional"
        min={0}
        step="0.01"
        widthClass="w-full"
      />
      <FormNumber
        source="premio"
        label="Premio"
        min={0}
        step="0.01"
        widthClass="w-full"
      />
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
        />
      }
      defaultValues={effectiveValues}
    >
      <SectionBaseTemplate
        title="Datos de la novedad"
        main={
          <TarjaNovedadFields
            lockReferences={effectiveLockReferences}
            defaultValues={effectiveValues}
            empleadoLabel={empleadoLabel}
            empleadoCategoriaId={empleado?.nomina_categoria_id}
            empleadoTareaId={empleado?.nomina_tarea_id}
          />
        }
        defaultOpen
      />
    </SimpleForm>
  );
};
