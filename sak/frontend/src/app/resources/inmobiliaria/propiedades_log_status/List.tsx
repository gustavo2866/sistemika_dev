"use client";

import { List } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { ExportButton } from "@/components/export-button";
import { ReferenceField } from "@/components/reference-field";
import {
  buildListFilters,
  ListPaginator,
  ListText,
  ListDate,
  ResponsiveDataTable,
  ListColumn,
} from "@/components/forms/form_order";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar cambios",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "propiedad_id",
        reference: "propiedades",
        label: "Propiedad",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todas",
        className: "w-full",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "usuario_id",
        reference: "users",
        label: "Usuario",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-full",
      },
    },
    {
      type: "text",
      props: {
        source: "estado_nuevo",
        label: "Estado nuevo",
      },
    },
  ],
  { keyPrefix: "propiedades-log-status" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={filters}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const PropiedadesLogStatusList = () => (
  <List
    title="Log de Estados de Propiedad"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "fecha_cambio", order: "DESC" }}
    containerClassName="max-w-[980px] w-full mr-auto"
  >
    <ResponsiveDataTable
      rowClick={false}
      mobileConfig={{
        primaryField: "estado_nuevo",
        secondaryFields: ["propiedad_id", "usuario_id", "fecha_cambio"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ListColumn source="propiedad_id" label="Propiedad" className="w-[160px]">
        <ReferenceField source="propiedad_id" reference="propiedades" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="estado_anterior" label="Estado anterior" className="w-[120px]">
        <ListText source="estado_anterior" />
      </ListColumn>
      <ListColumn source="estado_nuevo" label="Estado nuevo" className="w-[120px]">
        <ListText source="estado_nuevo" />
      </ListColumn>
      <ListColumn source="fecha_cambio" label="Fecha" className="w-[120px]">
        <ListDate source="fecha_cambio" />
      </ListColumn>
      <ListColumn source="usuario_id" label="Usuario" className="w-[140px]">
        <ReferenceField source="usuario_id" reference="users" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="motivo" label="Motivo" className="w-[160px]">
        <ListText source="motivo" className="whitespace-normal break-words" />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);
