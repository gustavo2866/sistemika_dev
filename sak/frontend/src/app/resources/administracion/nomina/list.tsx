"use client";

import { List, LIST_CONTAINER_XL } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { useRecordContext } from "ra-core";
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
import { ESTADO_CHOICES } from "./model";
import { NominaBackButton } from "./navigation-title";

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar empleados",
        alwaysOn: true,
        className: "w-[130px] sm:w-[180px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "encargado_contacto_id",
        reference: "crm/contactos",
        label: "Encargado",
      },
      selectProps: {
        optionText: "nombre_completo",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "nomina_categoria_id",
        reference: "nomina-categorias",
        label: "Categoria",
      },
      selectProps: {
        optionText: "descripcion",
        className: "w-full",
        emptyText: "Todas",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "nomina_tarea_id",
        reference: "nomina-tareas",
        label: "Tarea",
      },
      selectProps: {
        optionText: "descripcion",
        className: "w-full",
        emptyText: "Todas",
      },
    },
    {
      type: "select",
      props: {
        source: "activo",
        label: "Estado",
        choices: ESTADO_CHOICES,
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "idproyecto",
        reference: "nominas/proyectos",
        label: "Proyecto",
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "nominas" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const NombreCompletoField = () => {
  const record = useRecordContext<{ nombre?: string | null; apellido?: string | null }>();
  const apellido = String(record?.apellido ?? "").trim();
  const nombre = String(record?.nombre ?? "").trim();
  const value = [apellido, nombre].filter(Boolean).join(", ");
  return <span className="whitespace-normal break-words">{value || "-"}</span>;
};

const NominaListTitle = () => (
  <>
    <div className="sm:hidden">
      <NominaBackButton />
      <div className="-mt-0.5 flex items-center justify-center">
        <span>Nomina</span>
      </div>
    </div>
    <span className="hidden items-center gap-3 sm:inline-flex">
      <NominaBackButton />
      <span>Nomina</span>
    </span>
  </>
);

type NominaListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
  filter?: Record<string, unknown>;
  filterDefaultValues?: Record<string, unknown>;
  storeKey?: string;
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

export const NominaList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 5,
  createTo,
  filter,
  filterDefaultValues,
  storeKey,
}: NominaListProps = {}) => (
  <List
    resource="nominas"
    title={embedded ? undefined : <NominaListTitle />}
    filters={LIST_FILTERS}
    filterFormComponent={embedded ? StyledFilterDiv : undefined}
    actions={<ListActions createTo={createTo} />}
    filter={filter}
    filterDefaultValues={filterDefaultValues}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName={embedded ? "w-full max-w-none" : LIST_CONTAINER_XL}
    disableSyncWithLocation={embedded}
    storeKey={storeKey}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "apellido",
        secondaryFields: ["nombre", "nomina_categoria_id", "nomina_tarea_id", "idproyecto", "encargado_contacto_id"],
      }}
      className="text-[10px] [&_th]:text-[10px] [&_td]:text-[10px] xl:text-[11px] xl:[&_th]:text-[11px] xl:[&_td]:text-[11px]"
    >
      <NumberListColumn
        source="id"
        label="ID"
        className="w-[50px] text-center"
      />
      <TextListColumn source="apellido" label="Apellido y nombre" className="w-[210px]">
        <NombreCompletoField />
      </TextListColumn>
      <ListColumn source="nomina_categoria_id" label="Categoria" className="w-[150px]">
        <ReferenceField source="nomina_categoria_id" reference="nomina-categorias">
          <ListText source="descripcion" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="nomina_tarea_id" label="Tarea" className="w-[150px]">
        <ReferenceField source="nomina_tarea_id" reference="nomina-tareas">
          <ListText source="descripcion" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="idproyecto" label="Proyecto" className="w-[160px]">
        <ReferenceField source="idproyecto" reference="proyectos">
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="encargado_contacto_id" label="Encargado" className="w-[160px]">
        <ReferenceField source="encargado_contacto_id" reference="crm/contactos">
          <ListText source="nombre_completo" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <BooleanListColumn source="activo" label="Activo" className="w-[70px]" />
      <ListColumn label="Acciones" className="w-[56px]">
        <FormOrderListRowActions />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);

export default NominaList;
