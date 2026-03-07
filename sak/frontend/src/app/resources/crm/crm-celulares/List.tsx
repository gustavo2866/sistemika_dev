"use client";

import { List } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FormOrderListRowActions } from "@/components/forms/form_order";
import {
  BooleanListColumn,
  DateListColumn,
  ListDate,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar celulares",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "text",
      props: {
        source: "alias",
        label: "Alias",
      },
    },
    {
      type: "text",
      props: {
        source: "numero_celular",
        label: "Numero",
      },
    },
  ],
  { keyPrefix: "crm-celulares" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={filters}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const CRMCelularList = () => (
  <List
    title="CRM - Celulares"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName="max-w-[900px] w-full mr-auto"
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "alias",
        secondaryFields: ["numero_celular", "meta_celular_id", "activo"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="id" label="ID" className="w-[60px]">
        <ListText source="id" className="tabular-nums" />
      </TextListColumn>
      <TextListColumn source="alias" label="Alias">
        <ListText source="alias" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="numero_celular" label="Numero">
        <ListText source="numero_celular" className="whitespace-nowrap" />
      </TextListColumn>
      <TextListColumn source="meta_celular_id" label="Meta celular ID">
        <ListText source="meta_celular_id" className="whitespace-normal break-words" />
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" />
      <DateListColumn source="updated_at" label="Actualizado">
        <ListDate source="updated_at" />
      </DateListColumn>
      <TextListColumn label="Acciones">
        <FormOrderListRowActions />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

