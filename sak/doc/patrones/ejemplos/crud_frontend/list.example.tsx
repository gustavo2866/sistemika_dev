"use client";

import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { TextInput } from "@/components/text-input";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
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
import { useRecordContext, useRedirect, useResourceContext } from "ra-core";
import { MoreHorizontal } from "lucide-react";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar" alwaysOn />,
  <ReferenceInput key="estado" source="estado" reference="estados" label="Estado">
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

const ActionsMenu = () => {
  const record = useRecordContext();
  const redirect = useRedirect();
  const resource = useResourceContext();

  if (!record || !resource) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => redirect("edit", resource, record.id)}>
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => redirect("show", resource, record.id)}>
          Mostrar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const RecursoListExample = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <ResponsiveDataTable rowClick="edit">
      <ResponsiveDataTable.Col source="nombre" label="Nombre" className="min-w-[240px]">
        <TextField source="nombre" className="truncate" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="categoria_id" label="Categoria" className="w-[200px]">
        <ReferenceField source="categoria_id" reference="categorias">
          <TextField source="nombre" className="truncate" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col label="Acciones" className="w-[120px]">
        <ActionsMenu />
      </ResponsiveDataTable.Col>
    </ResponsiveDataTable>
  </List>
);
