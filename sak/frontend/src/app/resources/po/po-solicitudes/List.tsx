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
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDataProvider,
  useGetIdentity,
  useListContext,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
  useResourceContext,
} from "ra-core";
import { CheckCircle2, Eye, MoreHorizontal, Pencil, Trash2, XCircle } from "lucide-react";
import type { PoSolicitud } from "./model";
import { ESTADO_BADGES, ESTADO_CHOICES } from "./model";
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
// endregion

//********************************* */
// region 3. COMPONENTE

// Renderiza la lista principal de solicitudes PO.
export const PoSolicitudList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();
  const oportunidadIdFilter = getOportunidadIdFromLocation(location);
  const returnTo = getReturnToFromLocation(location);
  const defaultFilters = useMemo(
    () => ({
      estado: "borrador",
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
        rowClick="edit"
        className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
      >
        <ResponsiveDataTable.Col
          source="id"
          label="Id"
          className="w-[60px]"
          cellClassName="text-center"
          headerClassName="text-center"
        >
          <NumberField source="id" className="inline-block w-full text-center" />
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
          className="w-[110px] whitespace-normal break-words"
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
                <span className="text-[9px] leading-tight text-muted-foreground sm:text-[10px] break-words">
                  {name}
                </span>
              </div>
            );
          }}
        />
        <ResponsiveDataTable.Col
          source="fecha_necesidad"
          label="Fecha Nec"
          className="w-[110px] text-center"
        >
          <DateField source="fecha_necesidad" className="inline-block text-center w-full" />
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col
          source="estado"
          label="Estado"
          className="w-[120px]"
          render={(record) => {
            const estadoKey = String(record?.estado ?? "");
            return (
              <BadgeField
                source="estado"
                record={record}
                className={ESTADO_BADGES[estadoKey] || "bg-slate-100 text-slate-800"}
              />
            );
          }}
        />
        <ResponsiveDataTable.Col source="total" label="Importe" className="w-[140px]">
          <NumberField source="total" options={{ style: "currency", currency: "ARS" }} />
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col label="Acciones" className="w-[120px]">
          <PoSolicitudActionsMenu />
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
  const [initialized, setInitialized] = useState(false);

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
      setInitialized(true);
      return;
    }

    const hasOportunidadFilter =
      filterValues?.oportunidad_id != null &&
      String(filterValues.oportunidad_id).trim().length > 0;
    if (hasOportunidadFilter) {
      const nextFilters = { ...filterValues } as Record<string, unknown>;
      delete nextFilters.oportunidad_id;
      setFilters(nextFilters, { oportunidad_id: true });
      setInitialized(true);
      return;
    }

    const desiredSolicitanteId = defaultFilters.solicitante_id;
    const needsSolicitante =
      desiredSolicitanteId != null &&
      (filterValues?.solicitante_id == null ||
        String(filterValues.solicitante_id) !==
          String(desiredSolicitanteId));
    const needsEstado =
      defaultFilters.estado != null && filterValues?.estado == null;

    if (!initialized || needsSolicitante || needsEstado) {
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
      setInitialized(true);
    }
  }, [defaultFilters, filterValues, initialized, oportunidadIdFilter, setFilters]);

  return null;
};
// endregion

//********************************* */
// region 5. ACCIONES

// Menu estandar de acciones por fila.
const PoSolicitudActionsMenu = () => {
  const record = useRecordContext<PoSolicitud>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const resource = useResourceContext();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "delete" | null>(null);

  if (!record || !resource) {
    return null;
  }

  const canApprove = record.estado === "emitida";
  const canReject = record.estado === "emitida";

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const handleStatusChange = async (estado: "aprobada" | "rechazada") => {
    if (!record?.id) {
      return;
    }
    setBusyAction(estado);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("auth_token");
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }
      const response = await fetch(
        `${apiBaseUrl}/po-solicitudes/${record.id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ estado }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      notify(
        `Solicitud PO ${estado === "aprobada" ? "aprobada" : "rechazada"} correctamente`,
        { type: "info" }
      );
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la solicitud PO", { type: "warning" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!record?.id) return;
    setBusyAction("delete");
    try {
      await dataProvider.delete(resource, { id: record.id, previousData: record });
      notify("Solicitud PO eliminada", { type: "info" });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar la solicitud PO", { type: "warning" });
    } finally {
      setBusyAction(null);
    }
  };

  const stopRowClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMenuAction = (event: React.MouseEvent, callback: () => void) => {
    stopRowClick(event);
    if (busyAction !== null) {
      return;
    }
    callback();
  };

  const openConfirm = (action: "approve" | "reject" | "delete") => {
    if (busyAction !== null) return;
    setConfirmAction(action);
  };

  const closeConfirm = () => setConfirmAction(null);

  const confirmTitle = {
    approve: "Aprobar solicitud",
    reject: "Rechazar solicitud",
    delete: "Eliminar solicitud",
  }[confirmAction ?? "approve"];

  const confirmContent = {
    approve: "Seguro que deseas aprobar la solicitud?",
    reject: "Seguro que deseas rechazar la solicitud?",
    delete: "Seguro que deseas eliminar la solicitud?",
  }[confirmAction ?? "approve"];

  const handleConfirm = () => {
    const action = confirmAction;
    closeConfirm();
    if (!action) return;
    if (action === "delete") {
      handleDelete();
      return;
    }
    handleStatusChange(action === "approve" ? "aprobada" : "rechazada");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={busyAction !== null}
            onClick={stopRowClick}
            data-row-click="ignore"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 sm:w-44 text-[10px] sm:text-xs">
          <DropdownMenuItem
            onClick={(event) =>
              handleMenuAction(event, () => redirect("edit", resource, record.id))
            }
            disabled={busyAction !== null}
          >
            <Pencil className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) =>
              handleMenuAction(event, () => redirect("show", resource, record.id))
            }
            disabled={busyAction !== null}
          >
            <Eye className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Visualizar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => handleMenuAction(event, () => openConfirm("delete"))}
            disabled={busyAction !== null}
            variant="destructive"
          >
            <Trash2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Eliminar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {canApprove && (
            <DropdownMenuItem
              onClick={(event) =>
                handleMenuAction(event, () => openConfirm("approve"))
              }
              disabled={!canApprove || busyAction !== null}
            >
              <CheckCircle2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Aprobar
            </DropdownMenuItem>
          )}
          {canReject && (
            <DropdownMenuItem
              onClick={(event) =>
                handleMenuAction(event, () => openConfirm("reject"))
              }
              disabled={!canReject || busyAction !== null}
            >
              <XCircle className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Rechazar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        isOpen={confirmAction !== null}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmTitle}
        content={confirmContent}
        confirmColor={confirmAction === "delete" ? "warning" : "primary"}
        loading={busyAction !== null}
      />
    </>
  );
};
// endregion
