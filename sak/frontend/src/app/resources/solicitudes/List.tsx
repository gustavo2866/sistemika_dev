"use client";

import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useRedirect,
  useResourceContext,
} from "ra-core";
import { MoreHorizontal } from "lucide-react";
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

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const SolicitudList = () => (
  <List
    filters={filters}
    actions={<ListActions />}
    perPage={25}
    filterDefaultValues={{ estado: "pendiente" }}
  >
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
