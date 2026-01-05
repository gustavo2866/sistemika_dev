"use client";

import { useEffect } from "react";
import { useListContext } from "ra-core";
import { Target } from "lucide-react";
import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { DateField } from "@/components/date-field";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { EditButton } from "@/components/edit-button";
import { ResourceTitle } from "@/components/resource-title";
import { CRM_OPORTUNIDAD_ESTADO_CHOICES } from "./model";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar oportunidades" alwaysOn />,
  <SelectInput key="estado" source="estado" label="Estado" choices={CRM_OPORTUNIDAD_ESTADO_CHOICES} emptyText="Todos" />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="tipo_operacion_id"
    source="tipo_operacion_id"
    reference="crm/catalogos/tipos-operacion"
    label="Tipo de operaciИn"
    alwaysOn
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="propiedad_id" source="propiedad_id" reference="propiedades" label="Propiedad">
    <SelectInput optionText="nombre" emptyText="Todas" />
  </ReferenceInput>,
  <TextInput key="propiedad.tipo" source="propiedad.tipo" label="Tipo de propiedad" />,
  <ReferenceInput key="emprendimiento_id" source="emprendimiento_id" reference="emprendimientos" label="Emprendimiento">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
];

// Filtros válidos para esta lista
const VALID_FILTERS = ['q', 'estado', 'contacto_id', 'tipo_operacion_id', 'propiedad_id', 'propiedad.tipo', 'emprendimiento_id'];

const FilterCleaner = () => {
  const { filterValues, setFilters } = useListContext();

  useEffect(() => {
    // Limpiar filtros no válidos que vienen del localStorage o URL
    const invalidFilters = Object.keys(filterValues).filter(key => !VALID_FILTERS.includes(key));
    
    if (invalidFilters.length > 0) {
      console.log('Limpiando filtros no válidos:', invalidFilters);
      const cleanedFilters = Object.fromEntries(
        Object.entries(filterValues).filter(([key]) => VALID_FILTERS.includes(key))
      );
      setFilters(cleanedFilters, {});
    }
  }, [filterValues, setFilters]);

  return null;
};

const ListActions = () => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const CRMOportunidadList = () => (
  <List
    title={<ResourceTitle icon={Target} text="CRM - Oportunidades" />}
    filters={filters}
    actions={<ListActions />}
    perPage={10}
    sort={{ field: "created_at", order: "DESC" }}
  >
    <FilterCleaner />
    <DataTable rowClick="edit">
      <DataTable.Col source="id" label="ID">
        <TextField source="id" />
      </DataTable.Col>
      <DataTable.Col source="titulo" label="Titulo">
        <TextField source="titulo" className="whitespace-normal break-words max-w-[280px]" />
      </DataTable.Col>
      <DataTable.Col source="contacto_id" label="Contacto">
        <ReferenceField source="contacto_id" reference="crm/contactos">
          <TextField source="nombre_completo" className="whitespace-normal break-words max-w-[220px]" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="estado" label="Estado" className="w-[120px] min-w-[120px]">
        <TextField source="estado" />
      </DataTable.Col>
      <DataTable.Col source="responsable_id" label="Responsable">
        <ReferenceField source="responsable_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="fecha_estado" label="Fecha estado">
        <DateField source="fecha_estado" />
      </DataTable.Col>
      <DataTable.Col>
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);

export default CRMOportunidadList;
