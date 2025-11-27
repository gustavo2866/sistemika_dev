"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import { TextInput } from "@/components/text-input";
import { ResourceTitle } from "@/components/resource-title";
import { CalendarCheck } from "lucide-react";

const estadoChoices = [
  { id: "pendiente", name: "Pendiente" },
  { id: "hecho", name: "Hecho" },
];

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar eventos" className="w-full" alwaysOn />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <SelectInput key="estado_evento" source="estado_evento" label="Estado" choices={estadoChoices} emptyText="Todos" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const CRMEventoList = () => (
  <List
    title={<ResourceTitle icon={CalendarCheck} text="CRM - Eventos" />}
    filters={filters}
    actions={<ListActions />}
    perPage={10}
    sort={{ field: "fecha_evento", order: "DESC" }}
  >
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="contacto_id" label="Contacto">
        <ReferenceField source="contacto_id" reference="crm/contactos">
          <TextField source="nombre_completo" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="tipo_id" label="Tipo">
        <ReferenceField source="tipo_id" reference="crm/catalogos/tipos-evento">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="fecha_evento" label="Fecha">
        <TextField source="fecha_evento" />
      </DataTable.Col>
      <DataTable.Col source="estado_evento" label="Estado">
        <TextField source="estado_evento" />
      </DataTable.Col>
      <DataTable.Col source="asignado_a_id" label="Asignado">
        <ReferenceField source="asignado_a_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
