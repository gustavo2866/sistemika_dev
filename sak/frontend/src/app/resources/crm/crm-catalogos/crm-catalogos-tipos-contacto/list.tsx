"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import { List, LIST_CONTAINER_STANDARD_PLUS } from "@/components/list";
import {
  BooleanListColumn,
  FormOrderListRowActions,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";

//#region Configuracion del listado

const listFilters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar tipos de contacto",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "select",
      props: {
        source: "activo",
        label: "Estado",
        choices: [
          { id: "", name: "Todos" },
          { id: "true", name: "Activos" },
          { id: "false", name: "Inactivos" },
        ],
        optionText: "name",
        optionValue: "id",
        className: "w-[120px]",
      },
    },
  ],
  { keyPrefix: "crm-tipos-contacto" },
);

const listActionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const listMobileConfig = {
  primaryField: "nombre",
  secondaryFields: ["activo"],
};

//#endregion Configuracion del listado

//#region Componentes del listado

type CRMTipoContactoListProps = {
  embedded?: boolean;
  rowClick?: any;
  createTo?: string;
};

const CRMTipoContactoListActions = ({
  embedded: _embedded = false,
  createTo,
}: {
  embedded?: boolean;
  createTo?: string;
}) => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={listFilters}
      size="sm"
      buttonClassName={listActionButtonClass}
    />
    <CreateButton className={listActionButtonClass} label="Crear" to={createTo} />
    <ExportButton className={listActionButtonClass} label="Exportar" />
  </div>
);

export const CRMTipoContactoList = ({
  embedded = false,
  rowClick = "edit",
  createTo,
}: CRMTipoContactoListProps) => (
  <List
    title="CRM - Tipos de Contacto"
    filters={listFilters}
    actions={
      <CRMTipoContactoListActions embedded={embedded} createTo={createTo} />
    }
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
      <TextListColumn source="nombre" label="Nombre" className="w-[200px]">
        <ListText source="nombre" className="whitespace-normal break-words" />
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" />
      <TextListColumn label="Acciones" className="w-[80px]">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

//#endregion Componentes del listado
