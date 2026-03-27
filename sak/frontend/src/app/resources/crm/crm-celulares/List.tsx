"use client";

import { List, LIST_CONTAINER_STANDARD_PLUS } from "@/components/list";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  BooleanListColumn,
  DateListColumn,
  FormOrderListRowActions,
  ListDate,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";

//#region Configuracion del listado

// Define los filtros persistidos y visibles del listado.
const listFilters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar celulares",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
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

const listActionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const listMobileConfig = {
  primaryField: "alias",
  secondaryFields: ["numero_celular", "activo"],
};

//#endregion Configuracion del listado

//#region Componentes del listado

type CRMCelularListProps = {
  embedded?: boolean;
  rowClick?: any;
};

// Renderiza las acciones principales del encabezado del listado.
const CRMCelularListActions = ({ embedded = false }: { embedded?: boolean }) => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={listFilters}
      size="sm"
      buttonClassName={listActionButtonClass}
    />
    <CreateButton className={listActionButtonClass} label="Crear" />
    <ExportButton className={listActionButtonClass} label="Exportar" />
  </div>
);

// Renderiza la grilla principal del recurso de celulares CRM.
export const CRMCelularList = ({
  embedded = false,
  rowClick = "edit",
}: CRMCelularListProps) => (
  <List
    title="CRM - Celulares"
    filters={listFilters}
    actions={<CRMCelularListActions embedded={embedded} />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName={LIST_CONTAINER_STANDARD_PLUS}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={listMobileConfig}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="id" label="ID" className="w-[60px]">
        <ListText source="id" className="tabular-nums" />
      </TextListColumn>
      <TextListColumn source="alias" label="Alias" className="w-[180px]">
        <ListText source="alias" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="numero_celular" label="Numero" className="w-[160px]">
        <ListText source="numero_celular" className="whitespace-normal break-words" />
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" />
      <DateListColumn source="updated_at" label="Actualizado" className="w-[140px]">
        <ListDate source="updated_at" />
      </DateListColumn>
      <TextListColumn label="Acciones" className="w-[80px]">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

//#endregion Componentes del listado
