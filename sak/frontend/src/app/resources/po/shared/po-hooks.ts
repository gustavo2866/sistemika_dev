import { useEffect, useMemo, useRef } from "react";
import type { FieldValues, UseFormGetValues, UseFormReset, UseFormReturn } from "react-hook-form";
import { useFormContext, useWatch } from "react-hook-form";
import { getArticuloFilterByTipo } from "./po-utils";
import { useReferenceFieldWatcher } from "@/components/generic";


export const useArticuloFilterByTipoSolicitud = ({
  tipoSolicitudId,
  tiposSolicitudCatalog,
}: {
  tipoSolicitudId?: string;
  tiposSolicitudCatalog?: Array<{ id: number; tipo_articulo_filter_id?: number | null }>;
}) => {
  const articuloFilterId = useMemo(
    () => getArticuloFilterByTipo(tipoSolicitudId, tiposSolicitudCatalog),
    [tipoSolicitudId, tiposSolicitudCatalog]
  );

  const dynamicReferenceFilters = useMemo((): Record<string, Record<string, any>> => {
    if (!articuloFilterId) return {};
    return {
      articulo_id: {
        tipo_articulo_id: articuloFilterId,
      },
    };
  }, [articuloFilterId]);

  return { articuloFilterId, dynamicReferenceFilters };
};

const hasValue = (value: unknown) =>
  value !== null && value !== undefined && value !== "";

export const useMutuallyExclusiveFields = ({
  fieldA,
  fieldB,
  clearAWhenB = true,
  clearBWhenA = true,
  enabled = true,
  clearValue = null,
}: {
  fieldA: string;
  fieldB: string;
  clearAWhenB?: boolean;
  clearBWhenA?: boolean;
  enabled?: boolean;
  clearValue?: unknown;
}) => {
  const { setValue } = useFormContext();
  const valueA = useWatch({ name: fieldA });
  const valueB = useWatch({ name: fieldB });
  const prevRef = useRef({ valueA, valueB });

  useEffect(() => {
    if (!enabled) {
      prevRef.current = { valueA, valueB };
      return;
    }

    const prevA = prevRef.current.valueA;
    const prevB = prevRef.current.valueB;
    const aChanged = prevA !== valueA;
    const bChanged = prevB !== valueB;

    if (aChanged && !bChanged && clearBWhenA && hasValue(valueA) && hasValue(valueB)) {
      setValue(fieldB, clearValue, { shouldDirty: true, shouldValidate: true });
    }
    if (bChanged && !aChanged && clearAWhenB && hasValue(valueB) && hasValue(valueA)) {
      setValue(fieldA, clearValue, { shouldDirty: true, shouldValidate: true });
    }

    prevRef.current = { valueA, valueB };
  }, [
    valueA,
    valueB,
    enabled,
    clearAWhenB,
    clearBWhenA,
    clearValue,
    fieldA,
    fieldB,
    setValue,
  ]);
};

export const useLockedOportunidadField = ({
  lockedOportunidadId,
  enabled = true,
}: {
  lockedOportunidadId?: number;
  enabled?: boolean;
}) => {
  const { setValue, getValues, register } = useFormContext();
  const shouldLockOportunidad =
    enabled &&
    typeof lockedOportunidadId === "number" &&
    Number.isFinite(lockedOportunidadId);

  const { data: lockedOportunidadData } = useReferenceFieldWatcher(
    "oportunidad_id",
    "crm/oportunidades",
    { validation: (value) => !!value && typeof value === "object" }
  );

  useEffect(() => {
    if (!shouldLockOportunidad) return;
    const currentValue = getValues("oportunidad_id");
    if (currentValue !== lockedOportunidadId) {
      setValue("oportunidad_id", lockedOportunidadId, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [getValues, lockedOportunidadId, setValue, shouldLockOportunidad]);

  return {
    shouldLockOportunidad,
    lockedOportunidadData,
    registerOportunidad: () =>
      register("oportunidad_id", { valueAsNumber: true }),
  };
};

export const hasDefaultChanges = <T extends Record<string, unknown>>(
  defaults: T,
  values: T
) =>
  Object.keys(defaults).some((key) => {
    const typedKey = key as keyof T;
    return String(values[typedKey] ?? "") !== String(defaults[typedKey] ?? "");
  });

export const useWizardCancel = <T extends FieldValues>({
  defaultValues,
  formState,
  getValues,
  reset,
  setStep,
  onOpenChange,
  navigate,
  setConfirmCancelOpen,
  navigateTo = "/po-solicitudes",
}: {
  defaultValues: T;
  formState: UseFormReturn<T>["formState"];
  getValues: UseFormGetValues<T>;
  reset: UseFormReset<T>;
  setStep: (step: 1 | 2) => void;
  onOpenChange: (open: boolean) => void;
  navigate: (to: string) => void;
  setConfirmCancelOpen: (open: boolean) => void;
  navigateTo?: string;
}) => {
  const resetAndClose = () => {
    reset();
    setStep(1);
    onOpenChange(false);
    navigate(navigateTo);
  };

  const handleCancel = () => {
    const values = getValues();
    const hasChanges = hasDefaultChanges(defaultValues, values as T);
    if (formState.isDirty || hasChanges) {
      setConfirmCancelOpen(true);
      return;
    }
    resetAndClose();
  };

  const handleConfirmCancel = () => {
    setConfirmCancelOpen(false);
    resetAndClose();
  };

  return { handleCancel, handleConfirmCancel };
};
