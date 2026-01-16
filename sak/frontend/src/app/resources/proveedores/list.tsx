"use client";

import type { MouseEvent } from "react";
import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { ReferenceInput } from "@/components/reference-input";
import { ReferenceField } from "@/components/reference-field";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { BadgeField } from "@/components/badge-field";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useDataProvider, useNotify, useRecordContext, useRedirect, useRefresh, useResourceContext } from "ra-core";
import { MoreHorizontal } from "lucide-react";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar proveedores" alwaysOn />,
  <TextInput key="cuit" source="cuit" label="CUIT" />,
  <ReferenceInput
    key="concepto_id"
    source="concepto_id"
    reference="api/v1/adm/conceptos"
    label="Concepto"
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <BooleanInput key="activo" source="activo" label="Activo" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const ProveedorList = () => (
  <List filters={filters} actions={<ListActions />} debounce={300} perPage={25}>
    <ResponsiveDataTable rowClick="edit">
      <ResponsiveDataTable.Col source="nombre" label="Nombre" className="w-[220px]">
        <TextField source="nombre" className="block w-[220px] truncate" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="razon_social" label="Razon social" className="w-[260px]">
        <TextField source="razon_social" className="block w-[260px] truncate" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="concepto_id" label="Concepto" className="w-[200px]">
        <ReferenceField source="concepto_id" reference="api/v1/adm/conceptos">
          <TextField source="nombre" className="truncate" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="activo" label="Estado" className="w-[120px]">
        <BadgeField source="activo" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col label="Acciones" className="w-[120px]">
        <ProveedorActionsMenu />
      </ResponsiveDataTable.Col>
    </ResponsiveDataTable>
  </List>
);

const ProveedorActionsMenu = () => {
  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const resource = useResourceContext();

  if (!record || !resource) return null;

  const stopRowClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDelete = async () => {
    if (!record?.id) return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Seguro que deseas eliminar el proveedor?");
      if (!confirmed) return;
    }
    try {
      await dataProvider.delete(resource, { id: record.id });
      notify("Proveedor eliminado", { type: "info" });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar el proveedor", { type: "warning" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={(event) => {
            stopRowClick(event);
            redirect("edit", resource, record.id);
          }}
        >
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            stopRowClick(event);
            redirect("show", resource, record.id);
          }}
        >
          Mostrar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(event) => {
            stopRowClick(event);
            void handleDelete();
          }}
        >
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


