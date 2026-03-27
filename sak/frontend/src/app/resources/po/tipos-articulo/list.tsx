"use client";

import { List, LIST_CONTAINER_SM } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FormOrderListRowActions } from "@/components/forms/form_order";
import {
  BooleanListColumn,
  ListPaginator,
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
        placeholder: "Buscar tipos de articulo",
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
      type: "reference",
      referenceProps: {
        source: "adm_concepto_id",
        reference: "api/v1/adm/conceptos",
        label: "Concepto",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "select",
      props: {
        source: "activo",
        label: "Activo",
        choices: [
          { id: "true", name: "Si" },
          { id: "false", name: "No" },
        ],
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "tipos-articulo" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const listMobileConfig = {
  primaryField: "nombre",
  secondaryFields: ["adm_concepto_id", "descripcion", "activo"],
};

type TipoArticuloListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
};

const ListActions = ({ embedded = false }: { embedded?: boolean }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton
      filters={filters}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const TipoArticuloList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
}: TipoArticuloListProps = {}) => (
  <List
    title="Tipos de articulo"
    filters={filters}
    actions={<ListActions embedded={embedded} />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName={LIST_CONTAINER_SM}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={listMobileConfig}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="nombre" label="Nombre">
        <ListText source="nombre" />
      </TextListColumn>
      <TextListColumn source="adm_concepto_id" label="Concepto">
        <ReferenceField source="adm_concepto_id" reference="api/v1/adm/conceptos">
          <ListText source="nombre" />
        </ReferenceField>
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripcion">
        <ListText source="descripcion" />
      </TextListColumn>
      <BooleanListColumn source="activo" label="Estado" />
      <TextListColumn label="Acciones">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
