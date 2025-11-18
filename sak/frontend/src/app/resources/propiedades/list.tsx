"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { NumberField } from "@/components/number-field";
import { Badge } from "@/components/ui/badge";
import { SelectInput } from "@/components/select-input";
import {
  formatEstadoPropiedad,
  ESTADOS_PROPIEDAD_OPTIONS,
  type Propiedad,
} from "./model";
import {
  useRecordContext,
  useRefresh,
  useRedirect,
  useResourceContext,
} from "ra-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { ChangeStateDialog } from "./components/change-state-dialog";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar por nombre o propietario" alwaysOn />,
  <TextInput key="tipo" source="tipo" label="Tipo" />,
  <TextInput key="propietario" source="propietario" label="Propietario" />,
  <SelectInput
    key="estado"
    source="estado"
    label="Estado"
    choices={ESTADOS_PROPIEDAD_OPTIONS.map((option) => ({ id: option.value, name: option.label }))}
  />,
  <TextInput key="ambientes__gte" source="ambientes__gte" label="Ambientes >=" type="number" />,
  <TextInput key="ambientes__lte" source="ambientes__lte" label="Ambientes <=" type="number" />,
  <TextInput key="metros_cuadrados__gte" source="metros_cuadrados__gte" label="Metros2 >=" type="number" />,
  <TextInput key="metros_cuadrados__lte" source="metros_cuadrados__lte" label="Metros2 <=" type="number" />,
  <TextInput key="valor_alquiler__gte" source="valor_alquiler__gte" label="Alquiler >=" type="number" />,
  <TextInput key="valor_alquiler__lte" source="valor_alquiler__lte" label="Alquiler <=" type="number" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton className="h-9" />
  </div>
);

const PropiedadBulkActions = () => (
  <>
    <BulkDeleteButton />
  </>
);

export const PropiedadList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <DataTable rowClick="edit" bulkActionButtons={<PropiedadBulkActions />}>
      <DataTable.Col source="nombre" label="Nombre" className="w-[180px]">
        <div className="flex flex-col gap-0.5">
          <TextField source="nombre" className="font-medium truncate" />
          <span className="text-xs text-muted-foreground truncate">
            <TextField source="propietario" />
          </span>
        </div>
      </DataTable.Col>
      <DataTable.Col source="tipo" label="Tipo" className="w-[110px]">
        <TextField source="tipo" />
      </DataTable.Col>
      <DataTable.Col source="ambientes" label="Ambientes" className="w-[70px] text-right">
        <NumberField source="ambientes" />
      </DataTable.Col>
      <DataTable.Col source="metros_cuadrados" label="m²" className="w-[90px] text-right">
        <NumberField source="metros_cuadrados" options={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} />
      </DataTable.Col>
      <DataTable.Col source="valor_alquiler" label="Valor alquiler" className="w-[150px] text-right">
        <NumberField
          source="valor_alquiler"
          options={{ style: "currency", currency: "ARS", maximumFractionDigits: 0 }}
        />
      </DataTable.Col>
      <DataTable.Col source="estado" label="Estado" className="w-[120px]">
        <EstadoBadge />
      </DataTable.Col>
      <DataTable.Col label="Acciones" className="w-[64px] text-right pr-2">
        <PropiedadActionsMenu />
      </DataTable.Col>
    </DataTable>
  </List>
);

export const PropiedadActionsMenu = ({
  propiedad,
  onChanged,
}: {
  propiedad?: Propiedad;
  onChanged?: () => void;
}) => {
  const contextRecord = useRecordContext<Propiedad>();
  const record = propiedad ?? contextRecord;
  const resource = useResourceContext() || "propiedades";
  const redirect = useRedirect();
  const refresh = useRefresh();

  const handleCompleted = () => {
    refresh();
    onChanged?.();
  };

  if (!record) {
    return null;
  }

  const stopRowClick = (event?: React.MouseEvent) => {
    if (!event) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={stopRowClick}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={(event) => {
          event.stopPropagation();
          redirect("edit", resource, record.id);
        }}>
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(event) => {
          event.stopPropagation();
          redirect("show", resource, record.id);
        }}>
          Mostrar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ChangeStateDialog
          propiedadId={record.id}
          currentEstado={record.estado}
          estadoFecha={record.estado_fecha}
          onCompleted={handleCompleted}
          trigger={
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              Cambiar estado
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const EstadoBadge = () => {
  const record = useRecordContext<Propiedad>();

  if (!record) {
    return null;
  }

  const estado = ESTADOS_PROPIEDAD_OPTIONS.find((option) => option.value === record.estado);

  return (
    <Badge className={estado?.badgeColor ?? "bg-slate-200 text-slate-800"} variant="outline">
      {formatEstadoPropiedad(record.estado)}
    </Badge>
  );
};
