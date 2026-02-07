/**
 * Lista de PoSolicitudes.
 *
 * Estructura:
 * 1. CONFIGURACION - Filtros y acciones de lista
 * 2. HELPERS - Utilidades de presentacion locales
 * 3. COMPONENTE - Lista principal
 * 4. SINCRONIZACION - Sync de filtros y defaults
 * 5. ACCIONES - Menu estandar por fila
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  appendFilterParam,
  buildOportunidadFilter,
  getOportunidadIdFromLocation,
  getReturnToFromLocation,
} from "@/lib/oportunidad-context";
import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { DateField } from "@/components/date-field";
import { buildListFilters } from "@/components/lists/filters";
import {
  CompactFilterButton,
  CompactExportButton,
  CompactCreateButton,
} from "@/components/lists/actions";
import { BadgeField } from "@/components/badge-field";
import { KanbanAvatar } from "@/components/kanban/card";
import {
  useCreatePath,
  useGetIdentity,
  useListContext,
  useRefresh,
  useResourceContext,
} from "ra-core";
import type { PoSolicitud } from "./model";
import { ESTADO_BADGES, ESTADO_CHOICES } from "./model";
import { ListRowActions } from "./list_actions";
import { CrmContextHeader } from "./list_header_crm";

//********************************* */
// region 1. CONFIGURACION

// Define los filtros declarativos de la lista.
const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        alwaysOn: true,
        placeholder: "Buscar solicitudes PO",
        className: "w-28 sm:w-32",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "tipo_solicitud_id",
        reference: "tipos-solicitud",
        label: "Tipo",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "departamento_id",
        reference: "departamentos",
        label: "Departamento",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "centro_costo_id",
        reference: "centros-costo",
        label: "Centro de costo",
        filter: { activo: true },
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: ESTADO_CHOICES,
        alwaysOn: true,
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "solicitante_id",
        reference: "users",
        label: "Solicitante",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "po-solicitudes" }
);

// Renderiza acciones superiores de la lista.
const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center justify-start gap-2">
    <CompactFilterButton filters={filters as any} />
    {createTo ? <CompactCreateButton to={createTo} /> : null}
    <CompactExportButton />
  </div>
);
// endregion

//********************************* */
// region 2. HELPERS

// Arma datos de avatar del solicitante para la grilla.
const getSolicitanteAvatarInfo = (record?: PoSolicitud) => {
  const solicitante = (record as { solicitante?: { nombre?: string; nombre_completo?: string; email?: string; avatar?: string; url_foto?: string } })
    ?.solicitante;
  const name =
    solicitante?.nombre_completo ||
    solicitante?.nombre ||
    solicitante?.email ||
    (record?.solicitante_id ? `Usuario #${record.solicitante_id}` : "Usuario");
  const avatarUrl = solicitante?.avatar || solicitante?.url_foto || null;
  const initials = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return { name, avatarUrl, initials };
};

const truncateProveedor = (value?: string | null, limit: number = 15) => {
  if (!value) return "-";
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
};
// endregion

//********************************* */
// region 3. COMPONENTE

// Renderiza la lista principal de solicitudes PO.
export const PoSolicitudList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();
  const resource = useResourceContext();
  const createPath = useCreatePath();
  const oportunidadIdFilter = getOportunidadIdFromLocation(location);
  const returnTo = getReturnToFromLocation(location);
  const listReturnTo = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search]
  );
  const contextSearch = useMemo(() => {
    const params = new URLSearchParams();
    if (listReturnTo) {
      params.set("returnTo", listReturnTo);
    }
    if (oportunidadIdFilter) {
      appendFilterParam(params, buildOportunidadFilter(oportunidadIdFilter));
    }
    const search = params.toString();
    return search ? `?${search}` : "";
  }, [listReturnTo, oportunidadIdFilter]);
  const defaultFilters = useMemo(
    () => ({
      estado: "pendiente",
      ...(identity?.id ? { solicitante_id: identity.id } : {}),
    }),
    [identity?.id]
  );
  const createTo = useMemo(() => {
    const createPath = "/po-solicitudes/create";
    const params = new URLSearchParams();
    params.set("wizard", "asistida");
    if (oportunidadIdFilter) {
      appendFilterParam(params, buildOportunidadFilter(oportunidadIdFilter));
      params.set("returnTo", `${location.pathname}${location.search}`);
    }
    return `${createPath}?${params.toString()}`;
  }, [location.pathname, location.search, oportunidadIdFilter]);
  const rowClick = useMemo(() => {
    if (!contextSearch) return "edit";
    return (id: number | string) =>
      `${createPath({ resource, type: "edit", id })}${contextSearch}`;
  }, [contextSearch, createPath, resource]);

  return (
    <List
      filters={filters as any}
      actions={<ListActions createTo={createTo} />}
      perPage={10}
      sort={{ field: "id", order: "DESC" }}
      filterDefaultValues={defaultFilters}
    >
      <PoSolicitudesRefreshOnReturn location={location} navigate={navigate} refresh={refresh} />
      <PoSolicitudesFilterSync
        oportunidadIdFilter={oportunidadIdFilter}
        defaultFilters={defaultFilters}
      />
      <CrmContextHeader
        location={location}
        navigate={navigate}
        returnTo={returnTo}
        oportunidadId={oportunidadIdFilter}
      />
      <ResponsiveDataTable
        rowClick={rowClick}
        className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
      >
        <ResponsiveDataTable.Col
          source="id"
          label="Id"
          className="w-[44px]"
          cellClassName="text-center"
          headerClassName="text-center"
        >
          <NumberField source="id" className="inline-block w-full text-center text-[9px] sm:text-[10px]" />
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col
          source="titulo"
          label="Titulo"
          className="w-[120px] whitespace-normal break-words"
        >
          <TextField source="titulo" className="whitespace-normal break-words" />
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col
          source="solicitante_id"
          label="Solicitante"
          className="w-[90px] whitespace-nowrap"
          render={(record) => {
            const { name, avatarUrl, initials } = getSolicitanteAvatarInfo(record as PoSolicitud);
            return (
              <div className="flex w-full items-center gap-2">
                <KanbanAvatar
                  src={avatarUrl}
                  alt={name}
                  fallback={initials}
                  className="border-white/70 shadow-sm"
                />
                <span className="text-[9px] leading-tight text-muted-foreground sm:text-[10px] truncate">
                  {name}
                </span>
              </div>
            );
          }}
        />
        <ResponsiveDataTable.Col
          source="fecha_necesidad"
          label="Fecha Nec"
          className="w-[90px] text-center"
        >
          <DateField source="fecha_necesidad" className="inline-block text-center w-full text-[9px] sm:text-[10px]" />
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col
          source="estado"
          label="Estado"
          className="w-[90px]"
          render={(record) => {
            const estadoKey = String(record?.estado ?? "");
            return (
              <BadgeField
                source="estado"
                record={record}
                className={`${ESTADO_BADGES[estadoKey] || "bg-slate-100 text-slate-800"} text-[9px] sm:text-[10px]`}
              />
            );
          }}
        />
        <ResponsiveDataTable.Col source="total" label="Importe" className="w-[110px]">
          <NumberField source="total" options={{ style: "currency", currency: "ARS" }} className="text-[9px] sm:text-[10px]" />
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col
          source="proveedor_id"
          label="Proveedor"
          className="w-[110px] whitespace-nowrap"
          render={(record) => {
            const proveedorNombre = (record as { proveedor?: { nombre?: string } })?.proveedor?.nombre;
            if (proveedorNombre) {
              return (
                <span className="truncate">
                  {truncateProveedor(proveedorNombre, 15)}
                </span>
              );
            }
            const tipoSolicitudNombre = (record as { tipo_solicitud?: { nombre?: string } })?.tipo_solicitud?.nombre;
            return (
              <span className="truncate text-muted-foreground">
                {truncateProveedor(tipoSolicitudNombre ?? "Sin tipo", 15)}
              </span>
            );
          }}
        />
        <ResponsiveDataTable.Col label="Acciones" className="w-[120px]">
          <ListRowActions contextSearch={contextSearch} />
        </ResponsiveDataTable.Col>
      </ResponsiveDataTable>
    </List>
  );
};

// Fuerza refresh al volver desde create/edit cuando se pide.
const PoSolicitudesRefreshOnReturn = ({
  location,
  navigate,
  refresh,
}: {
  location: ReturnType<typeof useLocation>;
  navigate: ReturnType<typeof useNavigate>;
  refresh: () => void;
}) => {
  useEffect(() => {
    const state = location.state as { refresh?: boolean } | null;
    if (!state?.refresh) {
      return;
    }
    refresh();
    navigate(`${location.pathname}${location.search}`, { replace: true });
  }, [location, navigate, refresh]);

  return null;
};
// endregion

//********************************* */
// region 4. SINCRONIZACION

// Sincroniza filtros iniciales con identidad y contexto de oportunidad.
const PoSolicitudesFilterSync = ({
  oportunidadIdFilter,
  defaultFilters,
  }: {
    oportunidadIdFilter?: number | string;
    defaultFilters: Record<string, unknown>;
  }) => {
    const { filterValues, setFilters } = useListContext<PoSolicitud>();
    const [defaultsApplied, setDefaultsApplied] = useState(false);

    useEffect(() => {
      if (oportunidadIdFilter) {
        const needsOportunidad =
          filterValues?.oportunidad_id == null ||
        String(filterValues.oportunidad_id) !== String(oportunidadIdFilter);
      if (needsOportunidad) {
        setFilters(
          {
            ...filterValues,
            oportunidad_id: oportunidadIdFilter,
          },
          {}
        );
        }
        return;
      }

      const hasOportunidadFilter =
        filterValues?.oportunidad_id != null &&
        String(filterValues.oportunidad_id).trim().length > 0;
      if (hasOportunidadFilter) {
        const nextFilters = { ...filterValues } as Record<string, unknown>;
        delete nextFilters.oportunidad_id;
        setFilters(nextFilters, { oportunidad_id: true });
        return;
      }

      if (defaultsApplied) {
        return;
      }

      const desiredSolicitanteId = defaultFilters.solicitante_id;
      const hasSolicitanteFilter =
        filterValues?.solicitante_id != null &&
        String(filterValues.solicitante_id).trim().length > 0;
      const needsSolicitante =
        desiredSolicitanteId != null && !hasSolicitanteFilter;
      const needsEstado =
        defaultFilters.estado != null && filterValues?.estado == null;

      if (needsSolicitante || needsEstado) {
        const nextFilters = { ...filterValues };
        if (needsEstado) {
          nextFilters.estado = defaultFilters.estado;
        }
        if (needsSolicitante) {
          nextFilters.solicitante_id = desiredSolicitanteId;
        }
        setFilters(nextFilters, {
          estado: true,
          solicitante_id: true,
        });
        setDefaultsApplied(true);
        return;
      }
      setDefaultsApplied(true);
    }, [defaultFilters, defaultsApplied, filterValues, oportunidadIdFilter, setFilters]);

    return null;
  };
// endregion

//********************************* */
// region 5. ACCIONES

// endregion
