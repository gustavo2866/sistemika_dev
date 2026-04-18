"use client";

import { useMemo, useState } from "react";
import { useDataProvider, useGetList, useNotify, useRefresh } from "ra-core";
import { useLocation } from "react-router-dom";

import { resolveNumericId, useIdentityId } from "@/components/forms/form_order";
import { isClosedOportunidad } from "@/app/resources/crm/crm-oportunidades/model";
import type { Propiedad } from "./model";
import { getPropiedadStatusLabel } from "./status_transitions";
import { isTipoOperacionMantenimiento } from "./model";

type ChangeStatusPayload = {
  record: Propiedad;
  nextStatusId: number;
  fechaCambio: string;
  comentario?: string;
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
    oportunidades: (oportunidades as Array<{
      id?: unknown;
      titulo?: string | null;
      descripcion_estado?: string | null;
      created_at?: string | null;
      contacto?: { nombre?: string | null } | null;
      contacto_id?: unknown;
      estado?: string | null;
    }>).filter((oportunidad) => !isClosedOportunidad(oportunidad.estado as any)),
    isLoading: Boolean(propiedadId) && (Boolean(!tipoOperacionId) || (enabled && isPending)),
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
