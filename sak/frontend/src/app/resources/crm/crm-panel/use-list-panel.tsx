"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useListContext,
  useNotify,
} from "ra-core";
import { useRemoteKanban } from "@/components/forms/form_order";
import type { CRMOportunidad } from "../crm-oportunidades/model";
import { isClosedOportunidad } from "../crm-oportunidades/model";
import { captureOportunidadModalBackground } from "../crm-oportunidades/modal_background";
import { CRMOportunidadKanbanCard } from "./crm-panel-card";
import {
  buildPanelBucketFilter,
  buildPanelChange,
  getPanelBucketKey,
  getPanelBucketLabel,
  PANEL_BUCKET_CONFIG,
  PANEL_BUCKET_ORDER,
  PANEL_BUCKET_PAGE_SIZE,
  PANEL_BUCKET_SORT,
  type PanelBucketKey,
  type PanelChange,
  sortPanelBucketItems,
} from "./model";
import { isMantenimientoOportunidad } from "../crm-oportunidades/model";

const isMeaningfulFilterValue = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const FILTER_DEFAULTS_MARKER = "crm-panel:filters-initialized";

export const useListPanel = () => {
  const { filterValues, setFilters } = useListContext<CRMOportunidad>();
  const { identity, isPending: isIdentityPending } = useGetIdentity();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search],
  );
  const locationState = location.state as { panelChange?: PanelChange } | null;
  const pendingPanelChange = locationState?.panelChange;
  const [defaultsReady, setDefaultsReady] = useState(false);
  const [processedPanelChangeKey, setProcessedPanelChangeKey] = useState<
    string | null
  >(null);
  const { data: tiposOperacion } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const alquilerId = useMemo(() => {
    const alquiler = tiposOperacion?.find(
      (tipo: any) =>
        tipo?.codigo?.toLowerCase().includes("alquiler") ||
        tipo?.nombre?.toLowerCase().includes("alquiler"),
    );
    return alquiler?.id ? String(alquiler.id) : undefined;
  }, [tiposOperacion]);

  useEffect(() => {
    if (defaultsReady) {
      return;
    }
    if (tiposOperacion === undefined || isIdentityPending) {
      return;
    }

    const hasInitializedDefaults =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(FILTER_DEFAULTS_MARKER) === "1";

    if (hasInitializedDefaults) {
      setDefaultsReady(true);
      return;
    }

    const nextFilters = {
      ...(filterValues as Record<string, unknown>),
    };
    let hasChanges = false;

    if (!isMeaningfulFilterValue(nextFilters.activo)) {
      nextFilters.activo = true;
      hasChanges = true;
    }

    if (
      identity?.id &&
      !isMeaningfulFilterValue(nextFilters.responsable_id)
    ) {
      nextFilters.responsable_id = identity.id;
      hasChanges = true;
    }

    if (
      alquilerId &&
      !isMeaningfulFilterValue(nextFilters.tipo_operacion_id)
    ) {
      nextFilters.tipo_operacion_id = alquilerId;
      hasChanges = true;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(FILTER_DEFAULTS_MARKER, "1");
    }

    if (hasChanges) {
      setFilters(nextFilters, {});
      return;
    }

    setDefaultsReady(true);
  }, [
    alquilerId,
    defaultsReady,
    filterValues,
    identity?.id,
    isIdentityPending,
    setFilters,
    tiposOperacion,
  ]);

  const canLoadBuckets = useMemo(
    () => tiposOperacion !== undefined && defaultsReady,
    [defaultsReady, tiposOperacion],
  );

  const remoteFilters = useMemo(() => {
    const nextFilters = Object.entries(
      filterValues as Record<string, unknown>,
    ).reduce<Record<string, unknown>>((acc, [key, value]) => {
      if (isMeaningfulFilterValue(value)) {
        acc[key] = value;
      }
      return acc;
    }, {});
    delete nextFilters.estado;
    delete nextFilters.estado__in;
    delete nextFilters.panel_window_days;
    return nextFilters;
  }, [filterValues]);

  const filterSignature = useMemo(
    () => JSON.stringify(remoteFilters),
    [remoteFilters],
  );

  const loadBucket = useCallback(
    async ({
      bucketKey,
      page,
      perPage,
      filters,
    }: {
      bucketKey: PanelBucketKey;
      page: number;
      perPage: number;
      filters: Record<string, unknown>;
    }) => {
      const response = await dataProvider.getList<CRMOportunidad>(
        "crm/oportunidades",
        {
          pagination: { page, perPage },
          sort: PANEL_BUCKET_SORT,
          filter: buildPanelBucketFilter(bucketKey, filters),
        },
      );

      return {
        items: response.data ?? [],
        total: typeof response.total === "number" ? response.total : undefined,
      };
    },
    [dataProvider],
  );

  const { bucketData, hasHydratedData, reloadBuckets, loadMore } =
    useRemoteKanban<CRMOportunidad, PanelBucketKey, Record<string, unknown>>({
      bucketKeys: PANEL_BUCKET_ORDER,
      filters: remoteFilters,
      filterSignature,
      enabled: canLoadBuckets,
      pageSize: PANEL_BUCKET_PAGE_SIZE,
      cacheKey: `crm-panel:${returnTo}`,
      loadBucket,
      sortItems: sortPanelBucketItems,
    });

  useEffect(() => {
    if (!canLoadBuckets) return;

    const panelChangeKey = pendingPanelChange
      ? `${pendingPanelChange.oportunidadId}:${pendingPanelChange.fromBucket}:${pendingPanelChange.intendedBucket}`
      : null;

    if (!panelChangeKey) {
      return;
    }

    const currentPanelChange = pendingPanelChange;
    if (!currentPanelChange) {
      return;
    }
    if (processedPanelChangeKey === panelChangeKey) {
      return;
    }
    setProcessedPanelChangeKey(panelChangeKey);

    if (!hasHydratedData) {
      navigate(returnTo, { replace: true });
      return;
    }

    void (async () => {
      try {
        const response = await dataProvider.getOne<CRMOportunidad>(
          "crm/oportunidades",
          { id: currentPanelChange.oportunidadId },
        );
        const updatedBucket = getPanelBucketKey(response.data?.estado);
        await reloadBuckets([currentPanelChange.fromBucket, updatedBucket]);
      } catch {
        await reloadBuckets([
          currentPanelChange.fromBucket,
          currentPanelChange.intendedBucket,
        ]);
      } finally {
        navigate(returnTo, { replace: true });
      }
    })();
  }, [
    canLoadBuckets,
    dataProvider,
    hasHydratedData,
    navigate,
    pendingPanelChange,
    processedPanelChangeKey,
    reloadBuckets,
    returnTo,
  ]);

  const renderCard = useCallback(
    (
      oportunidad: CRMOportunidad,
      _bucketKey?: PanelBucketKey,
      collapsed?: boolean,
      onToggleCollapse?: () => void,
    ) => (
      <CRMOportunidadKanbanCard
        key={oportunidad.id}
        oportunidad={oportunidad}
        collapsed={collapsed}
        updating={false}
        onToggleCollapse={onToggleCollapse}
        onEdit={(opp) => {
          const targetPath = isClosedOportunidad(opp.estado)
            ? `/crm/oportunidades/${opp.id}/show`
            : `/crm/oportunidades/${opp.id}`;
          navigate(targetPath, {
            state: { fromPanel: true, returnTo },
          });
        }}
        onAceptar={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}/accion_aceptar`, {
            state: {
              returnTo,
              background: captureOportunidadModalBackground(),
              panelChange: buildPanelChange(opp, "en-proceso"),
            },
          });
        }}
        onAgendar={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}/accion_agendar`, {
            state: {
              returnTo,
              background: captureOportunidadModalBackground(),
              panelChange: buildPanelChange(opp, "en-proceso"),
            },
          });
        }}
        onCotizar={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}/accion_cotizar`, {
            state: {
              returnTo,
              background: captureOportunidadModalBackground(),
              panelChange: buildPanelChange(opp, "en-proceso"),
            },
          });
        }}
        onReservar={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}/accion_reservar`, {
            state: {
              returnTo,
              background: captureOportunidadModalBackground(),
              panelChange: buildPanelChange(opp, "reservadas"),
            },
          });
        }}
        onCerrar={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}/accion_cerrar`, {
            state: {
              returnTo,
              background: captureOportunidadModalBackground(),
              panelChange: buildPanelChange(opp, "cerradas"),
            },
          });
        }}
        onDescartar={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}/accion_descartar`, {
            state: {
              returnTo,
              background: captureOportunidadModalBackground(),
              panelChange: buildPanelChange(opp, "cerradas"),
            },
          });
        }}
      />
    ),
    [navigate, returnTo],
  );

  const handleItemMove = useCallback(
    async (oportunidad: CRMOportunidad, targetBucket: PanelBucketKey) => {
      const currentEstado = oportunidad.estado;
      const currentBucket = getPanelBucketKey(currentEstado);
      const isMantenimiento = isMantenimientoOportunidad(oportunidad);

      if (currentBucket === targetBucket) {
        return { __skipUpdate: true };
      }

      if (isMantenimiento) {
        if (targetBucket !== "cerradas") {
          notify("Las oportunidades de mantenimiento solo pueden cerrarse.", {
            type: "warning",
          });
          return undefined;
        }

        navigate(`/crm/oportunidades/${oportunidad.id}/accion_cerrar`, {
          state: {
            returnTo,
            background: captureOportunidadModalBackground(),
            panelChange: buildPanelChange(oportunidad, targetBucket),
          },
        });
        return undefined;
      }

      if (targetBucket === "cerradas") {
        if (currentEstado === "0-prospect") {
          navigate(`/crm/oportunidades/${oportunidad.id}/accion_descartar`, {
            state: {
              returnTo,
              background: captureOportunidadModalBackground(),
              record: oportunidad,
              panelChange: buildPanelChange(oportunidad, targetBucket),
            },
          });
          return undefined;
        }

        navigate(`/crm/oportunidades/${oportunidad.id}/accion_cerrar`, {
          state: {
            returnTo,
            background: captureOportunidadModalBackground(),
            panelChange: buildPanelChange(oportunidad, targetBucket),
          },
        });
        return undefined;
      }

      if (targetBucket === "reservadas") {
        if (currentEstado !== "3-cotiza") {
          notify("Solo oportunidades en Cotiza pueden pasar a Reservadas.", {
            type: "warning",
          });
          return undefined;
        }

        navigate(`/crm/oportunidades/${oportunidad.id}/accion_reservar`, {
          state: {
            returnTo,
            background: captureOportunidadModalBackground(),
            panelChange: buildPanelChange(oportunidad, targetBucket),
          },
        });
        return undefined;
      }

      if (targetBucket === "en-proceso") {
        if (!["0-prospect", "5-ganada", "6-perdida"].includes(currentEstado)) {
          notify("Solo Prospect o Cerradas pueden volver a En proceso.", {
            type: "warning",
          });
          return undefined;
        }

        if (currentEstado === "0-prospect") {
          navigate(`/crm/oportunidades/${oportunidad.id}/accion_aceptar`, {
            state: {
              returnTo,
              background: captureOportunidadModalBackground(),
              panelChange: buildPanelChange(oportunidad, targetBucket),
            },
          });
          return undefined;
        }
      }

      const targetEstado = PANEL_BUCKET_CONFIG[targetBucket].dropEstado;
      if (!targetEstado) {
        return undefined;
      }

      const descripcion = `Cambio de estado a ${getPanelBucketLabel(targetBucket)}`;
      await dataProvider.create(
        `crm/oportunidades/${oportunidad.id}/cambiar-estado`,
        {
          data: {
            nuevo_estado: targetEstado,
            descripcion,
            usuario_id: identity?.id ?? 1,
            fecha_estado: new Date().toISOString(),
          },
        },
      );
      await reloadBuckets([currentBucket, targetBucket]);
      return { __skipUpdate: true };
    },
    [dataProvider, identity?.id, navigate, notify, reloadBuckets, returnTo],
  );

  return {
    bucketData,
    loadMore,
    handleItemMove,
    renderCard,
  };
};
