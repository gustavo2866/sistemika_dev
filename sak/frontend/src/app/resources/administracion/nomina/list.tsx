"use client";

import { List, LIST_CONTAINER_XL } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { FilterButton } from "@/components/filter-form";
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

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

export const NominaList = () => (
  <List
    resource="nominas"
    title="Nomina"
    filters={LIST_FILTERS}
    actions={<ListActions />}
    debounce={300}
    perPage={5}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName={LIST_CONTAINER_XL}
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["apellido", "dni", "categoria", "idproyecto"],
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
      <ListColumn source="categoria" label="Categoria" className="w-[110px]">
        <SelectField source="categoria" choices={CATEGORIA_CHOICES} />
      </ListColumn>
      <ListColumn source="idproyecto" label="Proyecto" className="w-[160px]">
        <ReferenceField source="idproyecto" reference="proyectos">
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <TextListColumn source="email" label="Email" className="w-[170px]">
        <ListText source="email" className="whitespace-normal break-words" />
      </TextListColumn>
      <DateListColumn source="fecha_ingreso" label="Ingreso" className="w-[80px]" />
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
