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
        placeholder: "Buscar respuestas",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "text",
      props: {
        source: "titulo",
        label: "Titulo",
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
  { keyPrefix: "crm-catalogos-respuestas" },
);

const listActionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const listMobileConfig = {
  primaryField: "titulo",
  secondaryFields: ["texto", "activo"],
};

//#endregion Configuracion del listado

//#region Componentes del listado

type CRMCatalogoRespuestaListProps = {
  embedded?: boolean;
  rowClick?: any;
};

// Renderiza las acciones principales del encabezado del listado.
const CRMCatalogoRespuestaListActions = ({ embedded = false }: { embedded?: boolean }) => (
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

// Renderiza la grilla principal del catalogo de respuestas.
export const CRMCatalogoRespuestaList = ({
  embedded = false,
  rowClick = "edit",
}: CRMCatalogoRespuestaListProps) => (
  <List
    title="CRM - Respuestas"
    filters={listFilters}
    actions={<CRMCatalogoRespuestaListActions embedded={embedded} />}
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
      <TextListColumn source="titulo" label="Titulo" className="w-[200px]">
        <ListText source="titulo" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="texto" label="Texto" className="w-[280px]">
        <ListText source="texto" className="whitespace-normal break-words" />
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" />
      <TextListColumn label="Acciones" className="w-[80px]">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

//#endregion Componentes del listado
