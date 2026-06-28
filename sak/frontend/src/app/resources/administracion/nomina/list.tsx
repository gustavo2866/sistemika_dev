"use client";

import { List, LIST_CONTAINER_XL } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import {
  BooleanListColumn,
  DateListColumn,
  FormOrderListRowActions,
  ListColumn,
  ListMoney,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { SelectField } from "@/components/select-field";
import { CATEGORIA_CHOICES, ESTADO_CHOICES } from "./model";
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
      type: "select",
      props: {
        source: "categoria",
        label: "Categoria",
        choices: CATEGORIA_CHOICES,
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
        reference: "proyectos",
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
        primaryField: "nombre",
        secondaryFields: ["apellido", "dni", "categoria", "idproyecto", "encargado_contacto_id"],
      }}
      className="text-[10px] [&_th]:text-[10px] [&_td]:text-[10px] xl:text-[11px] xl:[&_th]:text-[11px] xl:[&_td]:text-[11px]"
    >
      <NumberListColumn
        source="id"
        label="ID"
        className="w-[50px] text-center"
      />
      <TextListColumn source="nombre" label="Nombre" className="w-[130px]">
        <ListText source="nombre" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="apellido" label="Apellido" className="w-[130px]">
        <ListText source="apellido" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="dni" label="DNI" className="w-[90px]">
        <ListText source="dni" />
      </TextListColumn>
      <TextListColumn source="nro_legajo" label="Legajo" className="w-[80px]">
        <ListText source="nro_legajo" />
      </TextListColumn>
      <ListColumn source="categoria" label="Categoria" className="w-[110px]">
        <SelectField source="categoria" choices={CATEGORIA_CHOICES} />
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
      <TextListColumn source="email" label="Email" className="w-[170px]">
        <ListText source="email" className="whitespace-normal break-words" />
      </TextListColumn>
      <DateListColumn source="fecha_ingreso" label="Ingreso" className="w-[80px]" />
      <DateListColumn source="fecha_egreso" label="Egreso" className="w-[80px]" />
      <ListColumn source="salario_mensual" label="Salario" className="w-[90px] text-right">
        <ListMoney source="salario_mensual" showCurrency={false} />
      </ListColumn>
      <BooleanListColumn source="activo" label="Activo" className="w-[70px]" />
      <ListColumn label="Acciones" className="w-[56px]">
        <FormOrderListRowActions />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);

export default NominaList;
