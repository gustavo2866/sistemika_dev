"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { useRecordContext } from "ra-core";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const buildPdfUrl = (value?: unknown) => {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  if (value.startsWith("http")) {
    return value;
  }
  const normalised = value
    .replace(/\\+/g, "/")
    .replace(/^\//, "");
  if (normalised.startsWith("uploads/")) {
    return `${apiBase}/${normalised}`;
  }
  return `${apiBase}/uploads/facturas/${normalised}`;
};

const PdfLinkCell = () => {
  const record = useRecordContext<{ ruta_archivo_pdf?: string; nombre_archivo_pdf?: string }>();
  const url = buildPdfUrl(record?.ruta_archivo_pdf);
  if (!url) {
    return <span className="text-muted-foreground">-</span>;
  }
  const title = record?.nombre_archivo_pdf ?? "Abrir PDF";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      asChild
      onClick={(event) => event.stopPropagation()}
    >
      <a href={url} target="_blank" rel="noopener noreferrer" title={title}>
        <FileText className="h-4 w-4" />
        <span className="sr-only">{title}</span>
      </a>
    </Button>
  );
};

const estadoChoices = [
  { id: "pendiente", name: "Pendiente" },
  { id: "procesada", name: "Procesada" },
  { id: "aprobada", name: "Aprobada" },
  { id: "rechazada", name: "Rechazada" },
  { id: "pagada", name: "Pagada" },
  { id: "anulada", name: "Anulada" },
];

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar facturas" alwaysOn />,
  <TextInput key="numero" source="numero" label="Numero" />,
  <ReferenceInput key="tipo_operacion_id" source="tipo_operacion_id" reference="tipos-operacion" label="Tipo de operacion">
    <SelectInput optionText="descripcion" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="usuario_responsable_id" source="usuario_responsable_id" reference="users" label="Usuario responsable">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <SelectInput key="estado" source="estado" label="Estado" choices={estadoChoices} emptyText="Todos" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

const FacturaBulkActions = () => (
  <>
    <BulkDeleteButton />
  </>
);

export const FacturaList = () => (
  <List filters={filters} actions={<ListActions />} debounce={300} perPage={25}>
    <DataTable rowClick="edit" bulkActionButtons={<FacturaBulkActions />}>
      <DataTable.Col source="numero">
        <TextField source="numero" />
      </DataTable.Col>
      <DataTable.Col source="tipo_comprobante" label="Tipo">
        <TextField source="tipo_comprobante" />
      </DataTable.Col>
      <DataTable.Col label="Proveedor">
        <ReferenceField source="proveedor_id" reference="proveedores">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col label="Tipo de operacion">
        <ReferenceField source="tipo_operacion_id" reference="tipos-operacion">
          <TextField source="descripcion" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col label="Usuario responsable">
        <ReferenceField source="usuario_responsable_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="fecha_emision" label="Emision">
        <TextField source="fecha_emision" />
      </DataTable.Col>
      <DataTable.Col source="total" label="Total">
        <NumberField source="total" options={{ style: "currency", currency: "ARS" }} />
      </DataTable.Col>
      <DataTable.Col source="estado" label="Estado">
        <TextField source="estado" />
      </DataTable.Col>
      <DataTable.Col label="PDF">
        <PdfLinkCell />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
