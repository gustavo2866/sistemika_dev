"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { DateField } from "@/components/date-field";
import { ReferenceField } from "@/components/reference-field";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { BadgeField } from "@/components/badge-field";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import { KanbanAvatar } from "@/components/kanban/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRecordContext,
  useRefresh,
  useRedirect,
  useListContext,
  useResourceContext,
} from "ra-core";
import { ArrowLeft, Calendar, House, MessageCircle, MoreHorizontal } from "lucide-react";
import type { PoSolicitud } from "./model";
import { ESTADO_BADGES, ESTADO_CHOICES } from "./model";

const filters = [
  <TextInput
    key="q"
    source="q"
    label="Buscar"
    alwaysOn
    placeholder="Buscar solicitudes PO"
  />,
  <ReferenceInput
    key="tipo_solicitud_id"
    source="tipo_solicitud_id"
    reference="tipos-solicitud"
    label="Tipo"
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="departamento_id"
    source="departamento_id"
    reference="departamentos"
    label="Departamento"
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="centro_costo_id"
    source="centro_costo_id"
    reference="centros-costo"
    label="Centro de costo"
    filter={{ activo: true }}
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <SelectInput
    key="estado"
    source="estado"
    label="Estado"
    choices={ESTADO_CHOICES}
    alwaysOn
  />,
  <ReferenceInput
    key="solicitante_id"
    source="solicitante_id"
    reference="users"
    label="Solicitante"
    alwaysOn
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
];

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton to={createTo} />
    <ExportButton />
  </div>
);

const getOportunidadIdFromLocation = (location: ReturnType<typeof useLocation>) => {
  const params = new URLSearchParams(location.search);
  const rawFilter = params.get("filter");
  if (rawFilter) {
    try {
      const parsed = JSON.parse(rawFilter);
      if (parsed?.oportunidad_id != null) {
        const numeric = Number(parsed.oportunidad_id);
        if (Number.isFinite(numeric) && numeric > 0) {
          return numeric;
        }
      }
    } catch {
      // ignore invalid filter param
    }
  }
  const direct = params.get("oportunidad_id");
  if (direct != null) {
    const numeric = Number(direct);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return undefined;
};

const getReturnToFromLocation = (location: ReturnType<typeof useLocation>) => {
  const params = new URLSearchParams(location.search);
  return params.get("returnTo") ?? undefined;
};

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


export const PoSolicitudList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity();
  const oportunidadIdFilter = getOportunidadIdFromLocation(location);
  const returnTo = getReturnToFromLocation(location);
  const defaultFilters = useMemo(
    () => ({
      estado: "pendiente",
      ...(identity?.id ? { solicitante_id: identity.id } : {}),
    }),
    [identity?.id]
  );
  const createTo = useMemo(() => {
    const createPath = "/po-solicitudes/create";
    if (!oportunidadIdFilter) return createPath;
    const params = new URLSearchParams();
    params.set("filter", JSON.stringify({ oportunidad_id: oportunidadIdFilter }));
    params.set("returnTo", `${location.pathname}${location.search}`);
    return `${createPath}?${params.toString()}`;
  }, [location.pathname, location.search, oportunidadIdFilter]);

  return (
    <List
      filters={filters}
      actions={<ListActions createTo={createTo} />}
      perPage={25}
      filterDefaultValues={defaultFilters}
      storeKey={false}
    >
      <PoSolicitudesFilterSync
        oportunidadIdFilter={oportunidadIdFilter}
        defaultFilters={defaultFilters}
      />
      <PoSolicitudesContextHeader
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
          source="titulo"
          label="Titulo"
          className="w-[160px] whitespace-normal break-words"
        >
          <TextField source="titulo" className="whitespace-normal break-words" />
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col
          source="solicitante_id"
          label="Solicitante"
          className="w-[80px]"
          render={(record) => {
            const { name, avatarUrl, initials } = getSolicitanteAvatarInfo(record as PoSolicitud);
            return (
              <div className="flex w-full items-center justify-start">
                <KanbanAvatar
                  src={avatarUrl}
                  alt={name}
                  fallback={initials}
                  className="border-white/70 shadow-sm"
                />
              </div>
            );
          }}
        />
        <ResponsiveDataTable.Col
          source="fecha_necesidad"
          label="Fecha necesidad"
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
    if (initialized) return;
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

    setFilters(
      { ...defaultFilters },
      {
        estado: true,
        solicitante_id: true,
      }
    );
    setInitialized(true);
  }, [defaultFilters, filterValues, initialized, oportunidadIdFilter, setFilters]);

  return null;
};

const PoSolicitudesContextHeader = ({
  location,
  navigate,
  returnTo,
  oportunidadId,
}: {
  location: ReturnType<typeof useLocation>;
  navigate: ReturnType<typeof useNavigate>;
  returnTo?: string;
  oportunidadId?: number | string;
}) => {
  const oportunidadIdNumeric =
    oportunidadId != null && Number.isFinite(Number(oportunidadId))
      ? Number(oportunidadId)
      : undefined;
  const shouldLoadOportunidad = typeof oportunidadIdNumeric === "number" && oportunidadIdNumeric > 0;
  const showContextHeader = Boolean(shouldLoadOportunidad);

  const { data: oportunidad } = useGetOne(
    "crm/oportunidades",
    { id: shouldLoadOportunidad ? oportunidadIdNumeric : undefined },
    { enabled: Boolean(shouldLoadOportunidad) }
  );
  const contactoId = (oportunidad as any)?.contacto_id ?? null;
  const { data: contacto } = useGetOne(
    "crm/contactos",
    { id: contactoId ?? 0 },
    { enabled: Boolean(contactoId) }
  );
  const contactoNombre =
    (contacto as any)?.nombre_completo ??
    (contacto as any)?.nombre ??
    (oportunidad as any)?.contacto?.nombre_completo ??
    (oportunidad as any)?.contacto?.nombre ??
    null;
  const oportunidadTitulo =
    (oportunidad as any)?.titulo ??
    (oportunidad as any)?.descripcion_estado ??
    (oportunidadIdNumeric ? `Oportunidad #${oportunidadIdNumeric}` : "");
  const contactoInitials = useMemo(() => {
    const base = contactoNombre ?? "Contacto";
    return base
      .split(/\s+/)
      .filter(Boolean)
      .map((part: string) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [contactoNombre]);

  const handleOpenChat = () => {
    if (oportunidadIdNumeric) {
      const params = new URLSearchParams();
      params.set("returnTo", `${location.pathname}${location.search}`);
      navigate(`/crm/chat/op-${oportunidadIdNumeric}/show?${params.toString()}`);
      return;
    }
    navigate(returnTo ?? "/crm/chat");
  };

  const handleOpenOportunidad = () => {
    if (!oportunidadIdNumeric) return;
    const params = new URLSearchParams();
    params.set("returnTo", `${location.pathname}${location.search}`);
    navigate(`/crm/oportunidades/${oportunidadIdNumeric}?${params.toString()}`);
  };

  const handleOpenEventos = () => {
    if (!oportunidadIdNumeric) return;
    const params = new URLSearchParams();
    params.set("filter", JSON.stringify({ oportunidad_id: oportunidadIdNumeric }));
    params.set("context", "solicitudes");
    params.set("returnTo", `${location.pathname}${location.search}`);
    navigate(`/crm/eventos?${params.toString()}`);
  };

  if (!showContextHeader) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm sm:mb-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => {
          if (returnTo) {
            navigate(returnTo);
          } else {
            navigate(-1);
          }
        }}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Avatar className="size-9 border border-slate-200">
        <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-600">
          {contactoInitials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {contactoNombre ?? "Contacto"}
        </p>
        <p className="truncate text-[10px] text-slate-500">
          {oportunidadTitulo} ({oportunidadIdNumeric ?? ""})
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1 text-slate-400">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleOpenChat}
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleOpenOportunidad}
          disabled={!oportunidadIdNumeric}
        >
          <House className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleOpenEventos}
          disabled={!oportunidadIdNumeric}
        >
          <Calendar className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const PoSolicitudActionsMenu = () => {
  const record = useRecordContext<PoSolicitud>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const resource = useResourceContext();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  if (!record || !resource) {
    return null;
  }

  const isPending = record.estado === "pendiente";
  const isApproved = record.estado === "aprobada";
  const canApprove = isPending;
  const canReject = isPending || isApproved;

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
      const response = await fetch(`${apiBaseUrl}/po-solicitudes/${record.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ estado }),
      });
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
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("¿Seguro que deseas eliminar la solicitud PO?");
      if (!confirmed) return;
    }
    setBusyAction("delete");
    try {
      await dataProvider.delete(resource, { id: record.id });
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

  const handleMenuAction = (
    event: React.MouseEvent,
    callback: () => void,
  ) => {
    stopRowClick(event);
    if (busyAction !== null) {
      return;
    }
    callback();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={busyAction !== null}
          onClick={stopRowClick}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={(event) =>
            handleMenuAction(event, () => redirect("edit", resource, record.id))
          }
          disabled={busyAction !== null}
        >
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) =>
            handleMenuAction(event, () => redirect("show", resource, record.id))
          }
          disabled={busyAction !== null}
        >
          Mostrar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => handleMenuAction(event, handleDelete)}
          disabled={busyAction !== null}
          variant="destructive"
        >
          Eliminar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(event) =>
            handleMenuAction(event, () => canApprove && handleStatusChange("aprobada"))
          }
          disabled={!canApprove || busyAction !== null}
        >
          Aprobar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) =>
            handleMenuAction(event, () => canReject && handleStatusChange("rechazada"))
          }
          disabled={!canReject || busyAction !== null}
        >
          Rechazar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


