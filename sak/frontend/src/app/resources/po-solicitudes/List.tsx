"use client";

import { useMemo, useState } from "react";
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
  useGetOne,
  useNotify,
  useRecordContext,
  useRefresh,
  useRedirect,
  useResourceContext,
} from "ra-core";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
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
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
];

const ListActions = ({ createState }: { createState?: Record<string, unknown> }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton state={createState} />
    <ExportButton />
  </div>
);

const getOportunidadIdFromLocation = (location: ReturnType<typeof useLocation>) => {
  const state = location.state as { filter?: Record<string, any>; oportunidad_id?: number | string } | null;
  if (state?.oportunidad_id) {
    return state.oportunidad_id;
  }
  const stateFilter = state?.filter;
  if (stateFilter?.oportunidad_id) {
    return stateFilter.oportunidad_id;
  }
  const params = new URLSearchParams(location.search);
  const rawFilter = params.get("filter");
  if (rawFilter) {
    try {
      const parsed = JSON.parse(rawFilter);
      if (parsed?.oportunidad_id) return parsed.oportunidad_id;
    } catch {
      // ignore invalid filter param
    }
  }
  const direct = params.get("oportunidad_id");
  if (direct) return direct;
  return undefined;
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
  const locationState = location.state as {
    returnTo?: string;
    oportunidad_id?: number;
    contacto_nombre?: string;
  } | null;
  const oportunidadIdFilter = getOportunidadIdFromLocation(location);
  const createState = oportunidadIdFilter
    ? { oportunidad_id: oportunidadIdFilter }
    : undefined;
  const returnTo = locationState?.returnTo;
  const showContextHeader = Boolean(returnTo || oportunidadIdFilter);
  const { data: oportunidad } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadIdFilter ?? 0 },
    { enabled: Boolean(oportunidadIdFilter) }
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
    locationState?.contacto_nombre ??
    null;
  const oportunidadTitulo =
    (oportunidad as any)?.titulo ??
    (oportunidad as any)?.descripcion_estado ??
    (oportunidadIdFilter ? `Oportunidad #${oportunidadIdFilter}` : "");
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

  return (
    <List
      filters={filters}
      actions={<ListActions createState={createState} />}
      perPage={25}
      filterDefaultValues={{ estado: "pendiente" }}
    >
      {showContextHeader ? (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm sm:mb-4">
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
              {oportunidadTitulo} ({oportunidadIdFilter ?? ""})
            </p>
          </div>
        </div>
      ) : null}
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


