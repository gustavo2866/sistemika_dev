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

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "reference",
      referenceProps: {
        source: "proyecto_id",
        reference: "proyectos",
        label: "Proyecto",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-[180px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "contacto_id",
        reference: "crm/contactos",
        label: "Contacto",
      },
      selectProps: {
        optionText: "nombre_completo",
        emptyText: "Todos",
        className: "w-[180px]",
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
  storeKey?: string;
  perPage?: number;
};

export const ProyectoEncargadoList = ({
  embedded = false,
  filter,
  filterDefaultValues,
  storeKey,
  perPage = 25,
}: ProyectoEncargadoListProps = {}) => (
  <List
    resource="proyecto-encargados"
    title={embedded ? undefined : "Encargados de proyecto"}
    filters={LIST_FILTERS}
    filterFormComponent={embedded ? StyledFilterDiv : undefined}
    actions={embedded ? undefined : <ListActions />}
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
      mobileConfig={{ primaryField: "proyecto_id", secondaryFields: ["contacto_id", "principal", "activo"] }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="proyecto_id" label="Proyecto" className="w-[220px]">
        <ReferenceField source="proyecto_id" reference="proyectos" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </TextListColumn>
      <TextListColumn source="contacto_id" label="Contacto" className="w-[220px]">
        <ReferenceField source="contacto_id" reference="crm/contactos" link={false}>
          <ListText source="nombre_completo" className="whitespace-normal break-words" />
        </ReferenceField>
      </TextListColumn>
      <BooleanListColumn source="principal" label="Principal" className="w-[90px]" />
      <BooleanListColumn source="activo" label="Activo" className="w-[80px]" />
      <DateListColumn source="desde" label="Desde" className="w-[100px]" />
      <DateListColumn source="hasta" label="Hasta" className="w-[100px]" />
      <TextListColumn source="notas" label="Notas">
        <ListText source="notas" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn label="Acciones" className="w-[56px]">
        <FormOrderListRowActions showShow={false} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default ProyectoEncargadoList;
