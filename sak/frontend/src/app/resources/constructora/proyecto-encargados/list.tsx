"use client";

import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import {
  BooleanListColumn,
  DateListColumn,
  FormOrderListRowActions,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { PROYECTO_ESTADO_CHOICES } from "../proyectos/model";

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "reference",
      referenceProps: {
        source: "proyecto_id",
        reference: "proyectos",
        label: "Proyecto",
        alwaysOn: true,
        className: "w-[240px] min-w-0 shrink-0",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-full min-w-0",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "contacto_id",
        reference: "crm/contactos",
        label: "Encargado",
        className: "w-[200px] min-w-0 shrink-0",
      },
      selectProps: {
        label: "Encargado",
        optionText: "nombre_completo",
        emptyText: "Todos",
        className: "w-full min-w-0",
      },
    },
    {
      type: "select",
      props: {
        source: "proyecto_estado",
        label: "Estado del proyecto",
        choices: PROYECTO_ESTADO_CHOICES,
        emptyText: "Todos",
      },
    },
    {
      type: "select",
      props: {
        source: "activo",
        label: "Activo",
        choices: [
          { id: true, name: "Activo" },
          { id: false, name: "Inactivo" },
        ],
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "proyecto-encargados" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={LIST_FILTERS} size="sm" buttonClassName={ACTION_BUTTON_CLASS} />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

type ProyectoEncargadoListProps = {
  embedded?: boolean;
  filter?: Record<string, unknown>;
  filterDefaultValues?: Record<string, unknown>;
  hideProyectoFilter?: boolean;
  hideProyectoColumn?: boolean;
  createState?: Record<string, unknown>;
  createTo?: string;
  storeKey?: string;
  perPage?: number;
};

export const ProyectoEncargadoList = ({
  embedded = false,
  filter,
  filterDefaultValues,
  hideProyectoFilter = false,
  hideProyectoColumn = false,
  createState,
  createTo,
  storeKey,
  perPage = 25,
}: ProyectoEncargadoListProps = {}) => {
  const filters = hideProyectoFilter
    ? LIST_FILTERS.filter((filterElement) => filterElement.props?.source !== "proyecto_id")
    : LIST_FILTERS;
  const actions = embedded ? (
    <div className="flex items-center gap-2">
      <FilterButton filters={filters} size="sm" buttonClassName={ACTION_BUTTON_CLASS} />
      <CreateButton
        className={ACTION_BUTTON_CLASS}
        label="Crear"
        to={createTo}
        state={createState}
      />
    </div>
  ) : (
    <ListActions />
  );

  return (
    <List
      resource="proyecto-encargados"
      title={embedded ? undefined : "Encargados de proyecto"}
      filters={filters}
      filterFormComponent={embedded ? StyledFilterDiv : undefined}
      actions={actions}
      filter={filter}
      filterDefaultValues={filterDefaultValues}
      debounce={300}
      perPage={perPage}
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      containerClassName={embedded ? "w-full min-w-0" : LIST_CONTAINER_WIDE}
      disableSyncWithLocation={embedded}
      storeKey={storeKey}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
    >
      <ResponsiveDataTable
        rowClick="edit"
        compact={embedded}
        mobileConfig={{ primaryField: "contacto_id", secondaryFields: ["principal", "activo"] }}
        className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
      >
        {!hideProyectoColumn ? (
          <TextListColumn source="proyecto_id" label="Proyecto" className="w-[170px]">
            <ReferenceField source="proyecto_id" reference="proyectos" link={false}>
              <ListText source="nombre" className="whitespace-normal break-words" />
            </ReferenceField>
          </TextListColumn>
        ) : null}
        <TextListColumn source="contacto_id" label="Encargado" className="w-[170px]">
          <ReferenceField source="contacto_id" reference="crm/contactos" link={false}>
            <ListText source="nombre_completo" className="whitespace-normal break-words" />
          </ReferenceField>
        </TextListColumn>
        <BooleanListColumn source="principal" label="Principal" className="w-[90px]" />
        <BooleanListColumn source="activo" label="Activo" className="w-[80px]" />
        {!embedded ? (
          <>
            <DateListColumn source="desde" label="Desde" className="w-[85px]" />
            <DateListColumn source="hasta" label="Hasta" className="w-[85px]" />
            <TextListColumn source="notas" label="Notas">
              <ListText source="notas" className="whitespace-normal break-words" />
            </TextListColumn>
          </>
        ) : null}
        <TextListColumn label="Acciones" className="w-[56px]">
          <FormOrderListRowActions showShow={false} />
        </TextListColumn>
      </ResponsiveDataTable>
    </List>
  );
};

export default ProyectoEncargadoList;
