"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { EditButton } from "@/components/edit-button";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { BadgeField } from "@/components/badge-field";
import { BulkExportButton } from "@/components/bulk-export-button";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { BulkApproveButton } from "@/components/bulk-approve-button";
import { BulkRejectButton } from "@/components/bulk-reject-button";
import { useRecordContext } from "ra-core";
import { FileText } from "lucide-react";

// Componente simple para mostrar PDF con URL completa
const PdfFileField = () => {
  const record = useRecordContext();
  
  if (!record?.ruta_archivo_pdf) {
    return <span className="text-gray-500">-</span>;
  }
  
  const pdfUrl = `http://localhost:8000/uploads/facturas/${record.ruta_archivo_pdf}`;
  const fileName = record.nombre_archivo_pdf || 'Ver PDF';
  
  return (
    <a
      href={pdfUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800"
      onClick={(e) => e.stopPropagation()}
      title={fileName}
      aria-label={fileName}
    >
      <FileText className="w-5 h-5" />
    </a>
  );
};

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar facturas..." alwaysOn />,
  <TextInput key="numero" source="numero" label="Número" placeholder="Filtrar por número" />,
  <ReferenceInput key="proveedor_id" source="proveedor_id" reference="proveedores" label="Proveedor">
    <SelectInput emptyText="Seleccionar proveedor" optionText="nombre" />
  </ReferenceInput>,
  <ReferenceInput key="usuario_responsable_id" source="usuario_responsable_id" reference="users" label="Usuario Responsable">
    <SelectInput emptyText="Seleccionar usuario" optionText="nombre" />
  </ReferenceInput>,
  <SelectInput 
    key="estado" 
    source="estado" 
    label="Estado"
    choices={[
      { id: "pendiente", name: "Pendiente" },
      { id: "procesada", name: "Procesada" },
      { id: "aprobada", name: "Aprobada" },
      { id: "rechazada", name: "Rechazada" },
      { id: "pagada", name: "Pagada" },
      { id: "anulada", name: "Anulada" }
    ]}
  />,
  <SelectInput 
    key="tipo_comprobante" 
    source="tipo_comprobante" 
    label="Tipo"
    choices={[
      { id: "A", name: "Factura A" },
      { id: "B", name: "Factura B" },
      { id: "C", name: "Factura C" },
      { id: "M", name: "Factura M" },
      { id: "NC", name: "Nota de Crédito" },
      { id: "ND", name: "Nota de Débito" }
    ]}
  />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

const FacturasBulkActionButtons = () => (
  <>
    <BulkApproveButton />
    <BulkRejectButton />
    <BulkExportButton />
    <BulkDeleteButton />
  </>
);

export default function FacturasList() {
  return (
    <List filters={filters} debounce={300} perPage={25} actions={<ListActions />}>
      <DataTable rowClick="edit" bulkActionButtons={<FacturasBulkActionButtons />}>
        <DataTable.Col source="numero">
          <TextField source="numero" />
        </DataTable.Col>
        
        <DataTable.Col source="tipo_comprobante">
          <TextField source="tipo_comprobante" />
        </DataTable.Col>
        
        <DataTable.Col label="Proveedor">
          <ReferenceField source="proveedor_id" reference="proveedores">
            <TextField source="nombre" />
          </ReferenceField>
        </DataTable.Col>
        
        <DataTable.Col label="Usuario Responsable">
          <ReferenceField source="usuario_responsable_id" reference="users">
            <TextField source="nombre" />
          </ReferenceField>
        </DataTable.Col>
        
        <DataTable.Col source="fecha_emision">
          <TextField source="fecha_emision" />
        </DataTable.Col>
        
        <DataTable.Col source="fecha_vencimiento">
          <TextField source="fecha_vencimiento" />
        </DataTable.Col>
        
        <DataTable.Col source="total">
          <NumberField source="total" options={{ style: 'currency', currency: 'ARS' }} />
        </DataTable.Col>
        
        <DataTable.Col label="Estado">
          <BadgeField source="estado" />
        </DataTable.Col>

        <DataTable.Col label="PDF">
          <PdfFileField />
        </DataTable.Col>

        <DataTable.Col>
          <EditButton />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}
