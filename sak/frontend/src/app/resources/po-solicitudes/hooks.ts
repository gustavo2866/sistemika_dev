"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useGetOne } from "ra-core";
import type { UseFormReturn } from "react-hook-form";
import type { TipoSolicitud } from "../tipos-solicitud/model";
import {
  TIPOS_SOLICITUD_REFERENCE,
  calculateTotal,
  getDepartamentoDefaultByTipo,
  type PoSolicitud,
} from "./model";

type SetValueFn = (
  name: "titulo" | "descripcion" | "cantidad" | "precio" | "proveedorId" | "fechaNecesidad" | "solicitanteId" | "oportunidadId" | "tipoSolicitudId" | "departamentoId" | "tipoCompra" | "articuloId",
  value: string | number,
  options?: { shouldDirty?: boolean }
) => void;

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

export const useTipoSolicitudBloqueado = (detallesValue: unknown) => {
  return useMemo(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    return detalles.length > 0;
  }, [detallesValue]);
};

export const useDepartamentoDefaultByTipo = ({
  form,
  idValue,
  tipoSolicitudValue,
  tiposSolicitudCatalog,
}: {
  form: UseFormReturn<PoSolicitud>;
  idValue: unknown;
  tipoSolicitudValue: unknown;
  tiposSolicitudCatalog: TipoSolicitudCatalog[];
}) => {
  const tipoSolicitudPreviousRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentTipo = tipoSolicitudValue
      ? String(tipoSolicitudValue)
      : undefined;

    if (!currentTipo || tiposSolicitudCatalog.length === 0) {
      tipoSolicitudPreviousRef.current = currentTipo;
      return;
    }

    const defaultDepartamento = getDepartamentoDefaultByTipo(
      currentTipo,
      tiposSolicitudCatalog
    );
    const previousTipo = tipoSolicitudPreviousRef.current;
    const isCreate = !idValue;
    const tipoChanged = Boolean(previousTipo) && previousTipo !== currentTipo;

    if (defaultDepartamento && (isCreate || tipoChanged)) {
      const currentDepartamento = form.getValues("departamento_id");
      const normalizedDepartamento = currentDepartamento?.toString();
      const departamentoDirty = Boolean(
        form.formState.dirtyFields?.departamento_id
      );
      if (!departamentoDirty && normalizedDepartamento !== defaultDepartamento) {
        const departamentoIdValue = Number(defaultDepartamento);
        if (!Number.isNaN(departamentoIdValue)) {
          form.setValue("departamento_id", departamentoIdValue, {
            shouldDirty: true,
          });
        }
      }
    }

    tipoSolicitudPreviousRef.current = currentTipo;
  }, [form, idValue, tipoSolicitudValue, tiposSolicitudCatalog]);
};

export const useProveedorDefaults = ({
  form,
  proveedorId,
}: {
  form: UseFormReturn<PoSolicitud>;
  proveedorId?: number;
}) => {
  const { data: proveedorDefaults } = useGetOne(
    "proveedores",
    { id: proveedorId ?? 0 },
    { enabled: Boolean(proveedorId) }
  );

  useEffect(() => {
    if (!proveedorId || !proveedorDefaults) {
      return;
    }

    const isEmptyValue = (value: unknown) =>
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "");

    const tipoSolicitudDefault = (proveedorDefaults as any)
      ?.default_tipo_solicitud_id;
    const tipoSolicitudDirty = Boolean(
      form.formState.dirtyFields?.tipo_solicitud_id
    );
    if (
      tipoSolicitudDefault &&
      (isEmptyValue(form.getValues("tipo_solicitud_id")) || !tipoSolicitudDirty)
    ) {
      form.setValue("tipo_solicitud_id", Number(tipoSolicitudDefault), {
        shouldDirty: true,
      });
    }

    const departamentoDefault = (proveedorDefaults as any)
      ?.default_departamento_id;
    const departamentoDirty = Boolean(
      form.formState.dirtyFields?.departamento_id
    );
    if (
      departamentoDefault &&
      (isEmptyValue(form.getValues("departamento_id")) || !departamentoDirty)
    ) {
      form.setValue("departamento_id", Number(departamentoDefault), {
        shouldDirty: true,
      });
    }
  }, [form, proveedorDefaults, proveedorId]);

  return proveedorDefaults;
};

export const useSyncTotalFromDetalles = ({
  form,
  detallesValue,
}: {
  form: UseFormReturn<PoSolicitud>;
  detallesValue: unknown;
}) => {
  useEffect(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    const calculated = calculateTotal(detalles as PoSolicitud["detalles"]);
    const currentTotal = Number(form.getValues("total") ?? 0);

    if (
      !Number.isNaN(calculated) &&
      Number(currentTotal.toFixed(2)) !== calculated
    ) {
      form.setValue("total", calculated, {
        shouldDirty: true,
      });
    }
  }, [detallesValue, form]);
};

export const useDefaultSolicitanteFromIdentity = ({
  identityId,
  solicitanteIdValue,
  setValue,
}: {
  identityId: number | null;
  solicitanteIdValue?: string | null;
  setValue: SetValueFn;
}) => {
  useEffect(() => {
    if (!identityId) return;
    if (solicitanteIdValue) return;
    setValue("solicitanteId", String(identityId), { shouldDirty: false });
  }, [identityId, solicitanteIdValue, setValue]);
};

export const useDefaultDepartamentoFromSolicitante = ({
  departamentoIdValue,
  solicitanteDepartamentoIdValue,
  setValue,
}: {
  departamentoIdValue?: string | null;
  solicitanteDepartamentoIdValue?: number | null;
  setValue: SetValueFn;
}) => {
  useEffect(() => {
    if (departamentoIdValue) return;
    if (solicitanteDepartamentoIdValue == null) return;
    setValue("departamentoId", String(solicitanteDepartamentoIdValue), {
      shouldDirty: true,
    });
  }, [departamentoIdValue, setValue, solicitanteDepartamentoIdValue]);
};

export const useDefaultArticuloFromProveedor = ({
  proveedorData,
  articuloIdValue,
  setValue,
}: {
  proveedorData?: unknown;
  articuloIdValue?: string | null;
  setValue: SetValueFn;
}) => {
  useEffect(() => {
    const defaultArticuloId = Number(
      (proveedorData as { default_articulos_id?: number | null } | undefined)
        ?.default_articulos_id ?? 0
    );
    if (!Number.isFinite(defaultArticuloId) || defaultArticuloId <= 0) {
      return;
    }
    if (articuloIdValue) {
      return;
    }
    setValue("articuloId", String(defaultArticuloId), { shouldDirty: true });
  }, [articuloIdValue, proveedorData, setValue]);
};

export const useDefaultPrecioFromArticulo = ({
  articuloData,
  precioValue,
  setValue,
}: {
  articuloData?: unknown;
  precioValue?: unknown;
  setValue: SetValueFn;
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
    setValue("precio", precioArticulo, { shouldDirty: true });
  }, [articuloData, precioValue, setValue]);
};
