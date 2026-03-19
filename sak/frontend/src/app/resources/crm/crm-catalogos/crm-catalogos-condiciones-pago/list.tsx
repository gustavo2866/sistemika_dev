"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import { List } from "@/components/list";
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

// Define los filtros persistidos y visibles del listado.
const listFilters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar condiciones de pago",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "text",
      props: {
        source: "codigo",
        label: "Codigo",
      },
    },
    {
      type: "select",
      props: {
        source: "activo",
        label: "Estado",
        choices: [
          { id: "", name: "Todos" },
          { id: "true", name: "Activas" },
          { id: "false", name: "Inactivas" },
        ],
        optionText: "name",
        optionValue: "id",
        className: "w-[120px]",
      },
    },
  ],
  { keyPrefix: "crm-condiciones-pago" },
);

const listActionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const listMobileConfig = {
  primaryField: "nombre",
  secondaryFields: ["codigo", "descripcion", "activo"],
};

//#endregion Configuracion del listado

//#region Componentes del listado

type CRMCondicionPagoListProps = {
  embedded?: boolean;
  rowClick?: any;
};

// Renderiza las acciones principales del encabezado del listado.
const CRMCondicionPagoListActions = ({ embedded = false }: { embedded?: boolean }) => (
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

// Renderiza la grilla principal del catalogo de condiciones de pago.
export const CRMCondicionPagoList = ({
  embedded = false,
  rowClick = "edit",
}: CRMCondicionPagoListProps) => (
  <List
    title="CRM - Condiciones de Pago"
    filters={listFilters}
    actions={<CRMCondicionPagoListActions embedded={embedded} />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName="max-w-[920px] w-full mr-auto"
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
      <TextListColumn source="codigo" label="Codigo" className="w-[120px]">
        <ListText source="codigo" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="nombre" label="Nombre" className="w-[180px]">
        <ListText source="nombre" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripcion" className="w-[200px]">
        <ListText source="descripcion" className="whitespace-normal break-words" />
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" />
      <TextListColumn label="Acciones" className="w-[80px]">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

//#endregion Componentes del listado
