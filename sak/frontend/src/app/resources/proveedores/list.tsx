"use client";

import { List } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import {
  CompactSoloActivasToggleFilter,
  FormOrderListRowActions,
} from "@/components/forms/form_order";
import {
  BooleanListColumn,
  ListPaginator,
  NumberListColumn,
  TextListColumn,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar proveedores",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "text",
      props: {
        source: "nombre",
        label: "Nombre",
      },
    },
    {
      type: "text",
      props: {
        source: "cuit",
        label: "CUIT",
      },
    },
    {
      type: "custom",
      element: (
        <CompactSoloActivasToggleFilter
          key="activo"
          source="activo"
          label="Activos"
          alwaysOn
          className="ml-auto"
        />
      ),
    },
  ],
  { keyPrefix: "proveedores" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const ProveedorList = () => (
  <List
    title="Proveedores"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={10}
    filterDefaultValues={{ activo: true }}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName="max-w-[900px] w-full mr-auto"
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["razon_social", "cuit", "activo"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <NumberListColumn source="id" label="ID" className="text-center" />
      <TextListColumn source="nombre" label="Nombre">
        <ListText source="nombre" />
      </TextListColumn>
      <TextListColumn source="razon_social" label="Razon social">
        <ListText source="razon_social" />
      </TextListColumn>
      <TextListColumn source="cuit" label="CUIT">
        <ListText source="cuit" />
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" />
      <TextListColumn label="Acciones">
        <FormOrderListRowActions />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
