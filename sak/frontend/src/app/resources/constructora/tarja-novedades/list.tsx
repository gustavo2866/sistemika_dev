"use client";

import { List, LIST_CONTAINER_XL } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import {
  BooleanListColumn,
  FormOrderListRowActions,
  ListColumn,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "reference",
      referenceProps: {
        source: "tarja_id",
        reference: "tarjas",
        label: "Tarja",
      },
      selectProps: {
        optionText: "descripcion",
        className: "w-full",
        emptyText: "Todas",
      },
    },
  ],
  { keyPrefix: "tarja-nomina" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

type TarjaNovedadListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
};

type TarjaNovedadRecord = {
  id: number | string;
  tipo_novedad?: string | null;
  editable?: boolean | null;
};

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" to={createTo} />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

export const TarjaNovedadList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
  createTo,
}: TarjaNovedadListProps = {}) => {
  const resolvedRowClick = (
    id: string | number,
    resource: string,
    record: TarjaNovedadRecord,
  ) => {
    if (record.tipo_novedad === "ALT" || record.editable === false) {
      return false;
    }
    if (typeof rowClick === "function") {
      return rowClick(id, resource, record);
    }
    return rowClick;
  };

  return (
    <List
      resource="tarja-nomina"
      title="Nomina de tarja"
      filters={LIST_FILTERS}
      actions={<ListActions createTo={createTo} />}
      debounce={300}
      perPage={perPage}
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      containerClassName={LIST_CONTAINER_XL}
      disableSyncWithLocation={embedded}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
    >
      <ResponsiveDataTable
        rowClick={resolvedRowClick}
        mobileConfig={{
          primaryField: "tarja_id",
          secondaryFields: ["tipo_novedad", "horas_justificadas", "presentismo"],
        }}
        className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
      >
        <NumberListColumn source="id" label="ID" className="w-[54px] text-center" />
        <ListColumn source="tarja_id" label="Tarja" className="w-[150px]">
          <ListText source="tarja_id" className="whitespace-normal break-words" />
        </ListColumn>
        <TextListColumn source="tipo_novedad" label="Tipo" className="w-[60px]">
          <ListText source="tipo_novedad" />
        </TextListColumn>
        <NumberListColumn source="horas_justificadas" label="Hs just." className="w-[76px] text-right" />
        <BooleanListColumn source="presentismo" label="Presentismo" className="w-[86px]" />
        <NumberListColumn source="adicional_importe" label="Adicional" className="w-[86px] text-right" />
        <NumberListColumn source="premio_importe" label="Premio" className="w-[86px] text-right" />
        <TextListColumn source="observaciones" label="Observaciones">
          <ListText source="observaciones" className="whitespace-normal break-words" />
        </TextListColumn>
        <ListColumn label="Acciones" className="w-[56px]">
          <FormOrderListRowActions showShow={!embedded} />
        </ListColumn>
      </ResponsiveDataTable>
    </List>
  );
};

export default TarjaNovedadList;
