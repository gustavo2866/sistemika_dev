"use client";

import { useEffect } from "react";
import { useListContext } from "ra-core";
import { CircleCheck, CircleOff, Target } from "lucide-react";
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
import { ButtonToggle } from "@/components/forms/button-toggle";

const ActivasToggleFilter = ({
  className,
}: {
  className?: string;
  source: string;
  [key: string]: unknown;
}) => {
  const { filterValues, setFilters } = useListContext();
  const value = filterValues.activo === true ? "activas" : "todas";

  const handleChange = (nextValue: "activas" | "todas") => {
    if (nextValue === "activas") {
      setFilters({ ...filterValues, activo: true }, {});
      return;
    }

    const { activo, ...rest } = filterValues;
    setFilters(rest, {});
  };

  return (
    <ButtonToggle
      aria-label="Filtrar activas"
      className={className}
      size="sm"
      variant="rounded"
      value={value}
      options={[
        { id: "activas", label: "Activas" },
        { id: "todas", label: "Todas" },
      ]}
      onChange={handleChange}
    />
  );
};

const filters = [
  <TextInput 
    key="q" 
    source="q" 
    label="Búsqueda" 
    placeholder="Buscar oportunidades" 
    alwaysOn 
    className="w-[200px] flex-shrink-0 [&_.form-label]:text-xs [&_.form-label]:mb-1 [&_input]:h-8 [&_input]:text-sm" 
  />,
  <ReferenceInput
    key="tipo_operacion_id"
    source="tipo_operacion_id"
    reference="crm/catalogos/tipos-operacion"
    label="Tipo de operación"
    alwaysOn
    className="w-[160px] flex-shrink-0 [&_.form-label]:text-xs [&_.form-label]:mb-1 [&_button]:h-8 [&_button]:text-sm"
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <SelectInput 
    key="estado" 
    source="estado" 
    label="Estado" 
    choices={CRM_OPORTUNIDAD_ESTADO_CHOICES} 
    emptyText="Todos" 
    className="w-[140px] flex-shrink-0 [&_.form-label]:text-xs [&_.form-label]:mb-1 [&_button]:h-8 [&_button]:text-sm" 
    alwaysOn
  />,
  <ActivasToggleFilter
    key="activo"
    source="activo"
    alwaysOn
    className="ml-auto flex-shrink-0"
  />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
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
const VALID_FILTERS = ['q', 'activo', 'estado', 'contacto_id', 'tipo_operacion_id', 'propiedad_id', 'propiedad.tipo', 'emprendimiento_id'];

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
    filterDefaultValues={{ activo: true }}
    perPage={10}
    sort={{ field: "created_at", order: "DESC" }}
  >
    <FilterCleaner />
    <DataTable
      rowClick="edit"
      rowClassName={(record) =>
        record?.activo === false
          ? "text-muted-foreground/70 bg-muted/20 hover:bg-muted/30"
          : undefined
      }
    >
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
      <DataTable.Col
        source="estado"
        label="Estado"
        className="w-[140px] min-w-[140px]"
        render={(record: { estado?: string; activo?: boolean }) => (
          record.activo === false ? (
            <div className="flex items-center gap-2">
              <CircleOff className="h-4 w-4 text-red-600" aria-label="Inactivo" />
              <span className="text-xs text-muted-foreground">{record.estado}</span>
            </div>
          ) : (
            <span>{record.estado}</span>
          )
        )}
      />
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
