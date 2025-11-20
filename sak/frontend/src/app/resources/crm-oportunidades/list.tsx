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
import { CRM_OPORTUNIDAD_ESTADO_CHOICES, CRM_OPORTUNIDAD_ESTADO_BADGES, formatEstadoOportunidad, CRMOportunidad } from "./model";
import { Badge } from "@/components/ui/badge";
import { useRecordContext } from "ra-core";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar oportunidades" className="w-full" />,
  <SelectInput key="estado" source="estado" label="Estado" choices={CRM_OPORTUNIDAD_ESTADO_CHOICES} emptyText="Todos" />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="propiedad_id" source="propiedad_id" reference="propiedades" label="Propiedad">
    <SelectInput optionText="nombre" emptyText="Todas" />
  </ReferenceInput>,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const CRMOportunidadList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25} sort={{ field: "created_at", order: "DESC" }}>
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="contacto_id" label="Contacto">
        <ReferenceField source="contacto_id" reference="crm/contactos">
          <TextField source="nombre_completo" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="propiedad_id" label="Propiedad">
        <ReferenceField source="propiedad_id" reference="propiedades">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="estado" label="Estado">
        <EstadoBadge />
      </DataTable.Col>
      <DataTable.Col source="monto" label="Monto">
        <NumberField source="monto" />
      </DataTable.Col>
      <DataTable.Col source="moneda_id" label="Moneda">
        <ReferenceField source="moneda_id" reference="monedas">
          <TextField source="codigo" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="responsable_id" label="Responsable">
        <ReferenceField source="responsable_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);

const EstadoBadge = () => {
  const record = useRecordContext<CRMOportunidad>();
  if (!record) return null;
  const className =
    CRM_OPORTUNIDAD_ESTADO_BADGES[record.estado] ??
    "bg-slate-200 text-slate-800";
  return (
    <Badge className={className} variant="outline">
      {formatEstadoOportunidad(record.estado)}
    </Badge>
  );
};
