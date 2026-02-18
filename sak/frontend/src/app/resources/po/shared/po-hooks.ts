import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useGetOne } from "ra-core";
import type {
  FieldValues,
  Path,
  UseFormGetValues,
  UseFormReset,
  UseFormReturn,
} from "react-hook-form";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { getArticuloFilterByTipo } from "./po-utils";
import type { TipoSolicitud } from "../../tipos-solicitud/model";
import { useReferenceFieldWatcher } from "@/components/generic";

const TIPOS_SOLICITUD_REFERENCE = {
  resource: "tipos-solicitud",
  limit: 50,
  staleTime: 10 * 60 * 1000,
} as const;


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
  value !== null &&
  value !== undefined &&
  value !== "" &&
  value !== 0 &&
  value !== "0";

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

    if (aChanged && clearBWhenA && hasValue(valueA) && hasValue(valueB)) {
      setValue(fieldB, clearValue, { shouldDirty: true, shouldValidate: true });
    }
    if (bChanged && clearAWhenB && hasValue(valueB) && hasValue(valueA)) {
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

// Protege el cambio de tipo de solicitud y limpia detalle tras confirmacion.
export const useTipoSolicitudChangeGuard = () => {
  const { setValue } = useFormContext();
  const tipoSolicitudId = useWatch({ name: "tipo_solicitud_id" }) as
    | number
    | undefined;
  const detalles = useWatch({ name: "detalles" }) as unknown[] | undefined;

  const prevTipoRef = useRef<number | undefined>(tipoSolicitudId);
  const [pendingTipo, setPendingTipo] = useState<number | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const articuloFilter = useMemo(
    () => (tipoSolicitudId != null ? { tipo_solicitud_id: tipoSolicitudId } : {}),
    [tipoSolicitudId]
  );

  useEffect(() => {
    if (prevTipoRef.current === tipoSolicitudId) return;

    const hasDetalles = (detalles ?? []).length > 0;
    if (hasDetalles) {
      setPendingTipo(tipoSolicitudId);
      setConfirmOpen(true);
      // revert until user confirms
      setValue("tipo_solicitud_id", prevTipoRef.current, { shouldDirty: false });
      return;
    }

    prevTipoRef.current = tipoSolicitudId;
  }, [tipoSolicitudId, detalles, setValue]);

  const confirmChange = () => {
    setConfirmOpen(false);
    prevTipoRef.current = pendingTipo;
    setValue("tipo_solicitud_id", pendingTipo, { shouldDirty: true });
    setValue("detalles", [], { shouldDirty: true });
    setPendingTipo(undefined);
  };

  const cancelChange = () => {
    setConfirmOpen(false);
    setPendingTipo(undefined);
  };

  return { articuloFilter, confirmOpen, confirmChange, cancelChange };
};

// Mantiene exclusividad entre centro de costo y oportunidad en cabecera.
export const useCentroCostoOportunidadExclusion = () => {
  const { setValue } = useFormContext();
  const centroCostoId = useWatch({ name: "centro_costo_id" }) as number | undefined;
  const oportunidadId = useWatch({ name: "oportunidad_id" }) as number | undefined;

  const prevCentro = useRef(centroCostoId);
  const prevOportunidad = useRef(oportunidadId);

  useEffect(() => {
    const centroChanged = prevCentro.current !== centroCostoId;
    const oportunidadChanged = prevOportunidad.current !== oportunidadId;

    if (
      centroChanged &&
      !oportunidadChanged &&
      hasValue(centroCostoId) &&
      hasValue(oportunidadId)
    ) {
      setValue("oportunidad_id", null, { shouldDirty: true, shouldValidate: true });
    }

    if (
      oportunidadChanged &&
      !centroChanged &&
      hasValue(oportunidadId) &&
      hasValue(centroCostoId)
    ) {
      setValue("centro_costo_id", null, { shouldDirty: true, shouldValidate: true });
    }

    prevCentro.current = centroCostoId;
    prevOportunidad.current = oportunidadId;
  }, [centroCostoId, oportunidadId, setValue]);
};

// Mantiene exclusividad entre centro de costo y oportunidad en detalle.
export const useDetalleCentroCostoOportunidadExclusion = () => {
  const { setValue } = useFormContext();
  const detalles = useWatch({ name: "detalles" }) as
    | Array<Record<string, unknown>>
    | undefined;

  const prevDetalles = useRef<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    const current = detalles ?? [];
    const previous = prevDetalles.current ?? [];

    current.forEach((row, index) => {
      const prevRow = previous[index] ?? {};
      const nextCentro = row?.centro_costo_id as number | undefined;
      const nextOportunidad = row?.oportunidad_id as number | undefined;
      const prevCentro = prevRow?.centro_costo_id as number | undefined;
      const prevOportunidad = prevRow?.oportunidad_id as number | undefined;
      const centroChanged = prevCentro !== nextCentro;
      const oportunidadChanged = prevOportunidad !== nextOportunidad;

      if (
        centroChanged &&
        !oportunidadChanged &&
        hasValue(nextCentro) &&
        hasValue(nextOportunidad)
      ) {
        setValue(`detalles.${index}.oportunidad_id`, null, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      if (
        oportunidadChanged &&
        !centroChanged &&
        hasValue(nextOportunidad) &&
        hasValue(nextCentro)
      ) {
        setValue(`detalles.${index}.centro_costo_id`, null, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    });

    prevDetalles.current = current;
  }, [detalles, setValue]);
};

export const useMutuallyExclusiveFieldsWithControl = ({
  control,
  setValue,
  fieldA,
  fieldB,
  clearAWhenB = true,
  clearBWhenA = true,
  enabled = true,
  clearValue = null,
}: {
  control: UseFormReturn["control"];
  setValue: UseFormReturn["setValue"];
  fieldA: string;
  fieldB: string;
  clearAWhenB?: boolean;
  clearBWhenA?: boolean;
  enabled?: boolean;
  clearValue?: unknown;
}) => {
  const valueA = useWatch({ control, name: fieldA });
  const valueB = useWatch({ control, name: fieldB });
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

    if (aChanged && clearBWhenA && hasValue(valueA) && hasValue(valueB)) {
      setValue(fieldB, clearValue, { shouldDirty: true, shouldValidate: true });
    }
    if (bChanged && clearAWhenB && hasValue(valueB) && hasValue(valueA)) {
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

export const useMutuallyExclusiveHandlers = ({
  setValue,
  fieldA,
  fieldB,
  clearAWhenB = true,
  clearBWhenA = true,
  enabled = true,
  clearValue = null,
}: {
  setValue: UseFormReturn["setValue"];
  fieldA: string;
  fieldB: string;
  clearAWhenB?: boolean;
  clearBWhenA?: boolean;
  enabled?: boolean;
  clearValue?: unknown;
}) => {
  const handleChangeA = (value: unknown) => {
    setValue(fieldA, value, { shouldDirty: true, shouldValidate: true });
    if (!enabled || !clearBWhenA) return;
    if (hasValue(value)) {
      setValue(fieldB, clearValue, { shouldDirty: true, shouldValidate: true });
    }
  };

  const handleChangeB = (value: unknown) => {
    setValue(fieldB, value, { shouldDirty: true, shouldValidate: true });
    if (!enabled || !clearAWhenB) return;
    if (hasValue(value)) {
      setValue(fieldA, clearValue, { shouldDirty: true, shouldValidate: true });
    }
  };

  return { handleChangeA, handleChangeB };
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
  navigateTo = "/po-orders",
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

export type TipoSolicitudCatalog = Pick<
  TipoSolicitud,
  "id" | "tipo_articulo_filter_id" | "departamento_default_id"
>;

export const useTipoSolicitudCatalog = () => {
  const dataProvider = useDataProvider();
  const { data: tiposSolicitudData } = useQuery<TipoSolicitudCatalog[]>({
    queryKey: ["tipos-solicitud", "defaults"],
    queryFn: async () => {
      const { data } = await dataProvider.getList(
        TIPOS_SOLICITUD_REFERENCE.resource,
        {
          pagination: { page: 1, perPage: TIPOS_SOLICITUD_REFERENCE.limit },
          sort: { field: "nombre", order: "ASC" },
          filter: {},
          meta: {
            __expanded_list_relations__: ["tipo_articulo_filter_rel"],
          },
        }
      );
      return data as TipoSolicitudCatalog[];
    },
    staleTime: TIPOS_SOLICITUD_REFERENCE.staleTime,
  });

  return {
    tiposSolicitudData: tiposSolicitudData ?? [],
    tiposSolicitudCatalog: tiposSolicitudData ?? [],
  };
};

export const useSyncTotalFromDetalles = <T extends Record<string, unknown>>({
  form,
  detallesValue,
  totalField,
  calculateTotal,
}: {
  form: UseFormReturn<T>;
  detallesValue: unknown;
  totalField?: Path<T>;
  calculateTotal: (detalles: unknown[]) => number;
}) => {
  useEffect(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    const calculated = calculateTotal(detalles);
    const totalFieldKey = (totalField ?? ("total" as Path<T>));
    const currentTotal = Number(form.getValues(totalFieldKey) ?? 0);

    if (
      !Number.isNaN(calculated) &&
      Number(currentTotal.toFixed(2)) !== calculated
    ) {
      form.setValue(totalFieldKey, calculated as any, {
        shouldDirty: true,
      });
    }
  }, [calculateTotal, detallesValue, form, totalField]);
};

export const useProveedorById = (proveedorId: number | null) =>
  useGetOne(
    "proveedores",
    { id: proveedorId ?? 0 },
    { enabled: proveedorId != null }
  );

export const useUserById = (userId: number | null) =>
  useGetOne("users", { id: userId ?? 0 }, { enabled: userId != null });

export const useDepartamentoById = (departamentoId: number | null) =>
  useGetOne(
    "departamentos",
    { id: departamentoId ?? 0 },
    { enabled: departamentoId != null }
  );

export const useArticuloById = (articuloId: number | null) =>
  useGetOne(
    "articulos",
    { id: articuloId ?? 0 },
    { enabled: articuloId != null }
  );

export const useArticuloPrecioDefault = ({
  articuloData,
  precioValue,
  setValue,
  fieldName = "precio",
}: {
  articuloData?: unknown;
  precioValue?: unknown;
  setValue: (name: string, value: unknown, options?: { shouldDirty?: boolean }) => void;
  fieldName?: string;
}) => {
  useEffect(() => {
    const precioActual = Number(precioValue ?? 0);
    if (Number.isFinite(precioActual) && precioActual > 0) {
      return;
    }
    const precioArticulo = Number(
      (articuloData as { precio?: number | string | null } | undefined)?.precio
    );
    if (!Number.isFinite(precioArticulo) || precioArticulo <= 0) {
      return;
    }
    setValue(fieldName, precioArticulo, { shouldDirty: true });
  }, [articuloData, fieldName, precioValue, setValue]);
};

const poOrderIdCache = new Map<number, number | null>();
const poOrderIdPending = new Map<number, Promise<number | null>>();

const resolveOcIdByDetailId = async (
  dataProvider: ReturnType<typeof useDataProvider>,
  detailId: number,
) => {
  if (poOrderIdCache.has(detailId)) {
    return poOrderIdCache.get(detailId) ?? null;
  }
  if (poOrderIdPending.has(detailId)) {
    return poOrderIdPending.get(detailId) ?? null;
  }

  const request = dataProvider
    .getOne("po-order-details", { id: detailId })
    .then(({ data }) => {
      const orderId = Number((data as { order_id?: number | string })?.order_id);
      const resolved = Number.isFinite(orderId) && orderId > 0 ? orderId : null;
      poOrderIdCache.set(detailId, resolved);
      poOrderIdPending.delete(detailId);
      return resolved;
    })
    .catch(() => {
      poOrderIdCache.set(detailId, null);
      poOrderIdPending.delete(detailId);
      return null;
    });

  poOrderIdPending.set(detailId, request);
  return request;
};

export const useOcIdByPoOrderDetailId = (
  poOrderDetailId?: number | string | null,
) => {
  const dataProvider = useDataProvider();
  const [ocId, setOcId] = useState<number | null>(null);

  const numericId = useMemo(() => {
    const value = Number(poOrderDetailId);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [poOrderDetailId]);

  useEffect(() => {
    let active = true;

    if (!numericId) {
      setOcId(null);
      return () => {
        active = false;
      };
    }

    const cached = poOrderIdCache.get(numericId);
    if (cached !== undefined) {
      setOcId(cached);
      return () => {
        active = false;
      };
    }

    resolveOcIdByDetailId(dataProvider, numericId).then((resolved) => {
      if (!active) return;
      setOcId(resolved);
    });

    return () => {
      active = false;
    };
  }, [numericId, dataProvider]);

  return ocId;
};
