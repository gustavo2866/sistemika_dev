"use client";

import { useCallback, useMemo, useState } from "react";
import { useDataProvider, useGetList, useNotify, useRecordContext, useRefresh } from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";

import { resolveNumericId, useIdentityId } from "@/components/forms/form_order";
import { isClosedOportunidad } from "@/app/resources/crm/crm-oportunidades/model";
import type { Propiedad, PropiedadFormValues } from "./model";
import { getPropiedadStatusLabel } from "./status_transitions";
import { isTipoOperacionMantenimiento } from "./model";

type ChangeStatusPayload = {
  record: Propiedad;
  nextStatusId: number;
  fechaCambio: string;
  comentario?: string;
};

export type PropiedadOrdenMantenimientoOportunidad = {
  id?: unknown;
  titulo?: string | null;
  descripcion_estado?: string | null;
  created_at?: string | null;
  contacto?: { nombre?: string | null } | null;
  contacto_id?: unknown;
  estado?: string | null;
};

export const useDefaultTipoOperacionId = () => {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return resolveNumericId(params.get("tipo_operacion_id"));
  }, [location.search]);
};

export const useTiposOperacionCatalog = () => {
  const { data: tiposOperacion = [] } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  return tiposOperacion as Array<{ id?: unknown; nombre?: string | null; codigo?: string | null }>;
};

export const useMantenimientoTipoOperacionId = () => {
  const tiposOperacion = useTiposOperacionCatalog();

  return useMemo(() => {
    const mantenimiento = (tiposOperacion ?? []).find((tipo: any) => isTipoOperacionMantenimiento(tipo));
    return (mantenimiento?.id as number | undefined) ?? null;
  }, [tiposOperacion]);
};

export const useMantenimientoOportunidadesActivas = (propiedadId?: number) => {
  const tipoOperacionId = useMantenimientoTipoOperacionId();
  const enabled = Boolean(propiedadId && tipoOperacionId);
  const { data: oportunidades = [], isPending } = useGetList<any>(
    "crm/oportunidades",
    {
      filter: {
        propiedad_id: propiedadId,
        tipo_operacion_id: tipoOperacionId,
        activo: true,
      },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled },
  );

  return {
    oportunidades: (oportunidades as PropiedadOrdenMantenimientoOportunidad[]).filter(
      (oportunidad) => !isClosedOportunidad(oportunidad.estado as any),
    ),
    isLoading: Boolean(propiedadId) && (Boolean(!tipoOperacionId) || (enabled && isPending)),
  };
};

export const formatPropiedadOrdenOportunidadLabel = (
  oportunidad: Pick<
    PropiedadOrdenMantenimientoOportunidad,
    "id" | "titulo" | "descripcion_estado" | "created_at" | "contacto"
  >,
) => {
  const title =
    String(oportunidad.descripcion_estado ?? "").trim() ||
    String(oportunidad.titulo ?? "").trim() ||
    `Oportunidad #${resolveNumericId(oportunidad.id) ?? "s/n"}`;
  const contacto = String(oportunidad.contacto?.nombre ?? "").trim();
  const createdAt = String(oportunidad.created_at ?? "").trim();

  return { title, contacto, createdAt };
};

export const usePropiedadOrdenesFlow = (propiedadId?: number) => {
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotify();
  const { oportunidades, isLoading } = useMantenimientoOportunidadesActivas(propiedadId);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const returnTo = `${location.pathname}${location.search}`;

  const buildCreatePath = useCallback(
    (selectedOportunidadId: number) => {
      const params = new URLSearchParams();
      params.set("oportunidad_id", String(selectedOportunidadId));
      params.set("lock_oportunidad", "1");
      params.set("lock_centro", "1");
      params.set("returnTo", returnTo);
      return `/po-orders/create?${params.toString()}`;
    },
    [returnTo],
  );

  const handleSelectOportunidad = useCallback(
    (selectedOportunidadId: number) => {
      navigate(buildCreatePath(selectedOportunidadId));
    },
    [buildCreatePath, navigate],
  );

  const handleCreateOrder = useCallback(() => {
    if (isLoading) return;
    if (oportunidades.length === 0) {
      notify("No hay oportunidades de mantenimiento abiertas para esta propiedad", {
        type: "warning",
      });
      return;
    }
    if (oportunidades.length === 1) {
      const onlyId = resolveNumericId(oportunidades[0]?.id);
      if (!onlyId) return;
      navigate(buildCreatePath(onlyId));
      return;
    }
    setSelectorOpen(true);
  }, [buildCreatePath, isLoading, navigate, notify, oportunidades]);

  return {
    oportunidades,
    isLoading,
    selectorOpen,
    setSelectorOpen,
    handleCreateOrder,
    handleSelectOportunidad,
  };
};

export const useNombreUnicoFormValidator = () => {
  const dataProvider = useDataProvider();
  const record = useRecordContext<Propiedad>();

  return async (values: PropiedadFormValues) => {
    const normalized = String(values?.nombre ?? "").trim();
    if (!normalized) return {};
    const currentNombre = String(record?.nombre ?? "").trim();
    if (currentNombre && currentNombre.toLowerCase() === normalized.toLowerCase()) {
      return {};
    }
    try {
      const result = await dataProvider.getList<Propiedad>("propiedades", {
        filter: { nombre__eq: normalized },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "DESC" },
      });
      const exists = (result.data ?? []).some(
        (item) =>
          String(item?.nombre ?? "").trim().toLowerCase() === normalized.toLowerCase() &&
          item.id !== record?.id,
      );
      return exists ? { nombre: "Ya existe una propiedad con ese nombre" } : {};
    } catch {
      return {};
    }
  };
};

export const usePropiedadStatusTransition = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identityId } = useIdentityId();
  const [loading, setLoading] = useState(false);

  const cambiarEstado = async ({
    record,
    nextStatusId,
    fechaCambio,
    comentario,
  }: ChangeStatusPayload) => {
    if (!record?.id) return false;
    if (!fechaCambio) {
      notify("Selecciona la fecha del cambio", { type: "warning" });
      return false;
    }
    if (!identityId) {
      notify("No se pudo identificar el usuario", { type: "warning" });
      return false;
    }

    const estadoNuevoNombre = getPropiedadStatusLabel(nextStatusId);
    const motivo = comentario?.trim() ? comentario.trim() : null;

    setLoading(true);
    try {
      await dataProvider.update("propiedades", {
        id: record.id,
        data: {
          propiedad_status_id: nextStatusId,
          estado_fecha: fechaCambio,
          estado_comentario: motivo,
          usuario_id: identityId,
        },
        previousData: record,
      });

      refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("propiedades-dashboard-refresh"));
      }
      notify(`Estado actualizado a ${estadoNuevoNombre}`, { type: "info" });
      return true;
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar el estado", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { cambiarEstado, loading };
};
