"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { ShowButton } from "@/components/show-button";
import { Badge } from "@/components/ui/badge";
import { useRecordContext } from "ra-core";
import type { Vacancia } from "../propiedades/model";

const filters = [
  <ReferenceInput
    key="propiedad_id"
    source="propiedad_id"
    reference="propiedades"
    label="Propiedad"
    alwaysOn
    perPage={50}
  >
    <SelectInput optionText="nombre" />
  </ReferenceInput>,
  <SelectInput
    key="ciclo_activo"
    source="ciclo_activo"
    label="Ciclo activo"
    choices={[
      { id: "true", name: "Activas" },
      { id: "false", name: "Cerradas" },
    ]}
  />,
  <TextInput key="fecha_recibida__gte" source="fecha_recibida__gte" label="Recibida desde" type="date" />,
  <TextInput key="fecha_recibida__lte" source="fecha_recibida__lte" label="Recibida hasta" type="date" />,
  <TextInput key="fecha_alquilada__gte" source="fecha_alquilada__gte" label="Realizada desde" type="date" />,
  <TextInput key="fecha_alquilada__lte" source="fecha_alquilada__lte" label="Realizada hasta" type="date" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
  </div>
);

export const VacanciaList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <DataTable rowClick="show">
      <DataTable.Col label="Propiedad">
        <ReferenceField source="propiedad_id" reference="propiedades">
          <div className="flex flex-col">
            <TextField source="nombre" />
            <span className="text-xs text-muted-foreground">
              <TextField source="tipo" />
            </span>
          </div>
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="ciclo_activo" label="Estado" className="w-[140px]">
        <CicloBadge />
      </DataTable.Col>
      <DataTable.Col source="fecha_recibida" label="Recibida" className="w-[160px]">
        <DateField source="fecha_recibida" showTime />
      </DataTable.Col>
      <DataTable.Col source="fecha_disponible" label="Disponible" className="w-[160px]">
        <DateField source="fecha_disponible" showTime />
      </DataTable.Col>
      <DataTable.Col source="fecha_alquilada" label="Realizada" className="w-[160px]">
        <DateField source="fecha_alquilada" showTime />
      </DataTable.Col>
      <DataTable.Col source="dias_totales" label="Dias totales" className="w-[110px] text-right">
        <TextField source="dias_totales" />
      </DataTable.Col>
      <DataTable.Col className="w-[120px]">
        <ShowButton />
      </DataTable.Col>
    </DataTable>
  </List>
);

const CicloBadge = () => {
  const record = useRecordContext<Vacancia>();
  if (!record) return null;
  return (
    <Badge variant={record.ciclo_activo ? "default" : "outline"}>
      {record.ciclo_activo ? "Activo" : "Cerrado"}
    </Badge>
  );
};

// Backwards compat export to match previous naming convention
export { VacanciaList as VacanciasList };
