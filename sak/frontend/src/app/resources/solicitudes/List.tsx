"use client";

import { useMemo } from "react";
import { BulkActionsToolbar } from "@/components/bulk-actions-toolbar";
import { DataTable } from "@/components/data-table";
import { DateField } from "@/components/date-field";
import { FilterButton } from "@/components/filter-form";
import { List } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { SelectInput } from "@/components/select-input";
import { TextField } from "@/components/text-field";
import { TextInput } from "@/components/text-input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  RecordContextProvider,
  Translate,
  type Identifier,
  type RaRecord,
  useListContext,
  useRecordContext,
} from "ra-core";
import { ClipboardList, FileEdit } from "lucide-react";
import { Link } from "react-router";

import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { Button } from "@/components/ui/button";

import { SolicitudFormValues, solicitudTipoChoices, truncateDescripcion } from "./model";

type SolicitudListRecord = SolicitudFormValues & RaRecord;

const filters = [
  <TextInput
    key="q"
    source="q"
    label={false}
    placeholder="Buscar solicitudes"
    alwaysOn
  />,
  <SelectInput
    key="tipo"
    source="tipo"
    label="Tipo"
    choices={[...solicitudTipoChoices]}
  />,
];

const tipoLabelMap = new Map(
  solicitudTipoChoices.map((choice) => [choice.id, choice.name] as const),
);

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <Button asChild>
      <Link to="/solicitudes/create-mb">
        <FileEdit className="h-4 w-4 mr-2" />
        Crear
      </Link>
    </Button>
  </div>
);

const SolicitudBulkActions = () => <BulkDeleteButton />;

const EditButtonMB = () => {
  const record = useRecordContext();
  if (!record) return null;
  
  return (
    <Button asChild variant="outline" size="sm">
      <Link to={`/solicitudes/${record.id}/edit-mb`}>
        <FileEdit className="h-4 w-4" />
      </Link>
    </Button>
  );
};

export const SolicitudList = () => {
  const isMobile = useIsMobile();

  return (
    <List
      filters={filters}
      actions={<ListActions />}
      perPage={25}
      sort={{ field: "id", order: "DESC" }}
    >
      {isMobile ? (
        <SolicitudMobileCards />
      ) : (
        <DataTable
          rowClick={(id) => `/solicitudes/${id}/edit-mb`}
          bulkActionButtons={<SolicitudBulkActions />}
        >
          <DataTable.Col source="id" label="ID" />
          <DataTable.Col source="tipo" label="Tipo">
            <TextField source="tipo" />
          </DataTable.Col>
          <DataTable.Col source="fecha_necesidad" label="Fecha necesidad">
            <DateField source="fecha_necesidad" />
          </DataTable.Col>
          <DataTable.Col label="Solicitante">
            <ReferenceField source="solicitante_id" reference="users">
              <TextField source="nombre" />
            </ReferenceField>
          </DataTable.Col>
          <DataTable.Col source="comentario" label="Comentario">
            <TextField source="comentario" />
          </DataTable.Col>
          <DataTable.Col label="Acciones">
            <EditButtonMB />
          </DataTable.Col>
        </DataTable>
      )}
    </List>
  );
};

const SolicitudMobileCards = () => {
  const {
    data,
    isLoading,
    selectedIds = [],
    onToggleItem,
  } = useListContext<SolicitudListRecord>();

  const hasRecords = (data ?? []).length > 0;
  
  const handleToggleItem = onToggleItem as ((id: Identifier) => void) | undefined;

  if (isLoading && !hasRecords) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card className="flex gap-3 p-4" key={`solicitud-skeleton-${index}`}>
            <Skeleton className="size-5 rounded-sm" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!hasRecords) {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <ClipboardList className="size-6 opacity-60" />
        <span>No se encontraron solicitudes.</span>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {data?.map((record, index) => (
          <RecordContextProvider
            key={record?.id ?? `solicitud-${index}`}
            value={record}
          >
            <SolicitudCard
              isSelected={
                record?.id != null && selectedIds.includes(record.id)
              }
              onToggleItem={handleToggleItem}
            />
          </RecordContextProvider>
        ))}
      </div>
      <BulkActionsToolbar>
        <SolicitudBulkActions />
      </BulkActionsToolbar>
    </>
  );
};

const SolicitudCard = ({
  isSelected,
  onToggleItem,
}: {
  isSelected: boolean;
  onToggleItem?: (id: Identifier) => void;
}) => {
  const record = useRecordContext<SolicitudListRecord>();

  const tipoLabel = useMemo(() => {
    const tipo = record?.tipo as "normal" | "directa" | undefined;
    if (!tipo) {
      return "Sin tipo";
    }
    return tipoLabelMap.get(tipo) ?? tipo;
  }, [record?.tipo]);

  const comentario = useMemo(
    () => truncateDescripcion(record?.comentario ?? null),
    [record?.comentario],
  );

  const showSeparator =
    record?.solicitante_id != null && !!record?.fecha_necesidad;

  if (!record) {
    return null;
  }

  return (
    <Card
      className={cn(
        "space-y-2 p-3 transition-shadow",
        isSelected && "border-primary/70 shadow-sm shadow-primary/20",
      )}
    >
      <div className="flex items-center gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => {
            if (record.id == null) return;
            onToggleItem?.(record.id);
          }}
          className="mt-0.5"
          aria-label="Seleccionar solicitud"
        />
        <div className="flex flex-1 flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                ID: {record.id ?? "--"}
              </span>
              {record.tipo ? (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {tipoLabel}
                </span>
              ) : null}
            </div>
            <Link
              to={`/solicitudes/${record.id}/edit-mb`}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              onClick={(event) => event.stopPropagation()}
            >
              <FileEdit className="size-4" />
              <Translate i18nKey="ra.action.edit">Edit</Translate>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <ReferenceField source="solicitante_id" reference="users" link={false}>
              <TextField source="nombre" />
            </ReferenceField>
            {showSeparator ? <span aria-hidden="true">•</span> : null}
            {record?.fecha_necesidad ? (
              <DateField source="fecha_necesidad" />
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">{comentario}</p>
        </div>
      </div>
    </Card>
  );
};

