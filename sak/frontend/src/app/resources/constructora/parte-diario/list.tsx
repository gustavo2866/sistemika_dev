"use client";

import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { SelectField } from "@/components/select-field";
import { ReferenceField } from "@/components/reference-field";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { useRecordContext } from "ra-core";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListDate,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { estadoParteChoices } from "./constants";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar partes diarios",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "idproyecto",
        reference: "proyectos",
        label: "Proyecto",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: estadoParteChoices,
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "parte-diario" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const listMobileConfig = {
  primaryField: "fecha",
  secondaryFields: ["idproyecto", "estado", "descripcion"],
};

type ParteDiarioListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
};

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

const DetalleCountField = () => {
  const record = useRecordContext<{ detalles?: Array<unknown> }>();
  const count = Array.isArray(record?.detalles) ? record.detalles.length : 0;
  return <span>{count}</span>;
};

export const ParteDiarioList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
}: ParteDiarioListProps = {}) => (
  <List
    title="Partes diarios"
    filters={filters}
    actions={<ListActions />}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "fecha", order: "DESC" }}
    containerClassName={LIST_CONTAINER_WIDE}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={listMobileConfig}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <DateListColumn source="fecha" label="Fecha" className="w-[120px]">
        <ListDate source="fecha" />
      </DateListColumn>
      <TextListColumn source="idproyecto" label="Proyecto" className="w-[180px]">
        <ReferenceField source="idproyecto" reference="proyectos" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </TextListColumn>
      <TextListColumn source="estado" label="Estado" className="w-[110px]">
        <SelectField source="estado" choices={estadoParteChoices} />
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripcion" className="w-[220px]">
        <ListText source="descripcion" className="whitespace-normal break-words" />
      </TextListColumn>
      <NumberListColumn label="Registros" className="w-[80px] text-center">
        <DetalleCountField />
      </NumberListColumn>
      <TextListColumn label="Acciones" className="w-[80px]">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default ParteDiarioList;
