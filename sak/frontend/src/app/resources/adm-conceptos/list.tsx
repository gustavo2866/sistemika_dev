"use client";

import type { MouseEvent } from "react";
import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { TextInput } from "@/components/text-input";
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
import { useDataProvider, useNotify, useRecordContext, useRedirect, useRefresh, useResourceContext } from "ra-core";
import { MoreHorizontal } from "lucide-react";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar" alwaysOn />,
  <TextInput key="nombre" source="nombre" label="Nombre" />,
  <TextInput key="cuenta" source="cuenta" label="Cuenta" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

const AdmConceptoActionsMenu = () => {
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
      const confirmed = window.confirm("Seguro que deseas eliminar el concepto?");
      if (!confirmed) return;
    }
    try {
      await dataProvider.delete(resource, { id: record.id });
      notify("Concepto eliminado", { type: "info" });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar el concepto", { type: "warning" });
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
        <DropdownMenuItem onClick={(event) => {
          stopRowClick(event);
          redirect("edit", resource, record.id);
        }}>
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(event) => {
          stopRowClick(event);
          redirect("show", resource, record.id);
        }}>
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

export const AdmConceptoList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <ResponsiveDataTable rowClick="edit">
      <ResponsiveDataTable.Col source="nombre" label="Nombre" className="min-w-[220px]">
        <TextField source="nombre" className="truncate" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="cuenta" label="Cuenta" className="w-[160px]">
        <TextField source="cuenta" className="truncate" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="descripcion" label="Descripcion" className="min-w-[240px]">
        <TextField source="descripcion" className="truncate" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col label="Acciones" className="w-[120px]">
        <AdmConceptoActionsMenu />
      </ResponsiveDataTable.Col>
    </ResponsiveDataTable>
  </List>
);
