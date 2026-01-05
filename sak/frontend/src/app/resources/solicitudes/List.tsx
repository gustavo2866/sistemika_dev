"use client";

import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
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
import type { Solicitud } from "./model";
import { ESTADO_CHOICES } from "./model";

const filters = [
  <TextInput
    key="q"
    source="q"
    label={false}
    alwaysOn
    placeholder="Buscar solicitudes"
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

export const SolicitudList = () => {
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
      <DataTable rowClick="edit">
        <DataTable.Col source="id" label="ID" className="w-[80px]">
          <TextField source="id" />
        </DataTable.Col>
        <DataTable.Col source="tipo_solicitud_id" label="Tipo" className="w-[180px]">
          <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud">
            <TextField source="nombre" />
          </ReferenceField>
        </DataTable.Col>
        <DataTable.Col source="departamento_id" label="Departamento" className="w-[180px]">
          <ReferenceField source="departamento_id" reference="departamentos">
            <TextField source="nombre" />
          </ReferenceField>
        </DataTable.Col>
        <DataTable.Col source="centro_costo_id" label="Centro de costo" className="w-[200px]">
          <ReferenceField source="centro_costo_id" reference="centros-costo">
            <TextField source="nombre" />
          </ReferenceField>
        </DataTable.Col>
        <DataTable.Col source="estado" label="Estado" className="w-[120px]">
          <BadgeField source="estado" />
        </DataTable.Col>
        <DataTable.Col source="fecha_necesidad" label="Fecha necesidad" className="w-[140px]">
          <DateField source="fecha_necesidad" />
        </DataTable.Col>
        <DataTable.Col source="solicitante_id" label="Solicitante" className="w-[200px]">
          <ReferenceField source="solicitante_id" reference="users">
            <TextField
              source="nombre"
              className="truncate inline-block max-w-[180px]"
            />
          </ReferenceField>
        </DataTable.Col>
        <DataTable.Col source="total" label="Total" className="w-[140px]">
          <NumberField source="total" options={{ style: "currency", currency: "ARS" }} />
        </DataTable.Col>
        <DataTable.Col label="Acciones" className="w-[120px]">
          <SolicitudActionsMenu />
        </DataTable.Col>
      </DataTable>
    </List>
  );
};

const SolicitudActionsMenu = () => {
  const record = useRecordContext<Solicitud>();
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
      const response = await fetch(`${apiBaseUrl}/solicitudes/${record.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ estado }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      notify(
        `Solicitud ${estado === "aprobada" ? "aprobada" : "rechazada"} correctamente`,
        { type: "info" }
      );
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la solicitud", { type: "warning" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!record?.id) return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("¿Seguro que deseas eliminar la solicitud?");
      if (!confirmed) return;
    }
    setBusyAction("delete");
    try {
      await dataProvider.delete(resource, { id: record.id });
      notify("Solicitud eliminada", { type: "info" });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar la solicitud", { type: "warning" });
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
