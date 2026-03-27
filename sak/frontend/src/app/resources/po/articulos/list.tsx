"use client";

import { List, LIST_CONTAINER_STANDARD } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import {
  CompactSoloActivasToggleFilter,
  FormOrderListRowActions,
} from "@/components/forms/form_order";
import {
  BooleanListColumn,
  ListMoney,
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
        placeholder: "Buscar articulos",
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
        source: "sku",
        label: "SKU",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "tipo_articulo_id",
        reference: "tipos-articulo",
        label: "Tipo articulo",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
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
  { keyPrefix: "articulos" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const listMobileConfig = {
  primaryField: "nombre",
  secondaryFields: [
    "tipo_articulo_id",
    "unidad_medida",
    "precio",
    "proveedor_id",
    "activo",
  ],
};

type ArticuloListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
};

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

export const ArticuloList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 10,
}: ArticuloListProps = {}) => (
  <List
    title="Articulos"
    filters={filters}
    actions={<ListActions />}
    perPage={perPage}
    filterDefaultValues={{ activo: true }}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName={LIST_CONTAINER_STANDARD}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={listMobileConfig}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <NumberListColumn source="id" label="ID" className="text-center" />
      <TextListColumn source="nombre" label="Nombre">
        <ListText source="nombre" />
      </TextListColumn>
      <TextListColumn source="tipo_articulo_id" label="Tipo articulo">
        <ReferenceField source="tipo_articulo_id" reference="tipos-articulo">
          <ListText source="nombre" />
        </ReferenceField>
      </TextListColumn>
      <TextListColumn source="proveedor_id" label="Proveedor">
        <ReferenceField source="proveedor_id" reference="proveedores">
          <ListText source="nombre" />
        </ReferenceField>
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" />
      <TextListColumn label="Acciones">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
