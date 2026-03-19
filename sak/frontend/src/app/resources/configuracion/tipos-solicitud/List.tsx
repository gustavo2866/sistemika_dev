"use client";

import { List } from "@/components/list";
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
        placeholder: "Buscar tipos de solicitud",
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
  ],
  { keyPrefix: "tipos-solicitud" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const listMobileConfig = {
  primaryField: "nombre",
  secondaryFields: [
    "descripcion",
    "tipo_articulo_filter",
    "departamento_default_id",
    "activo",
  ],
};

type TipoSolicitudListProps = {
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

export const TipoSolicitudList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
}: TipoSolicitudListProps = {}) => (
  <List
    title="Tipos de solicitud"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName="max-w-[720px] w-full mr-auto"
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
      <TextListColumn source="descripcion" label="Descripcion">
        <ListText source="descripcion" />
      </TextListColumn>
      <TextListColumn source="tipo_articulo_filter" label="Filtro Articulo">
        <ListText source="tipo_articulo_filter" />
      </TextListColumn>
      <TextListColumn source="departamento_default_id" label="Depto. Default">
        <ReferenceField source="departamento_default_id" reference="departamentos">
          <ListText source="nombre" />
        </ReferenceField>
      </TextListColumn>
      <BooleanListColumn source="activo" label="Estado" />
      <TextListColumn label="Acciones">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
