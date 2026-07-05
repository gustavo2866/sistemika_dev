"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListColumn,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_XL } from "@/components/list";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";

const MoneyField = ({ source }: { source: string }) => (
  <NumberField
    source={source}
    options={{ style: "currency", currency: "ARS" }}
    className="whitespace-nowrap text-right tabular-nums"
  />
);

const DecimalField = ({ source }: { source: string }) => (
  <NumberField
    source={source}
    options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
    className="whitespace-nowrap text-right tabular-nums"
  />
);

export const PROYECTOS_BUDGET_LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar presupuesto",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
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
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "proyectos_concepto_id",
        reference: "constructora/proyectos-conceptos",
        label: "Concepto",
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "proyectos_macrorubro_id",
        reference: "constructora/proyectos-macrorubros",
        label: "Macrorubro",
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "text",
      props: {
        source: "fecha",
        label: "Fecha",
        type: "date",
      },
    },
  ],
  { keyPrefix: "proyectos-budget" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={PROYECTOS_BUDGET_LIST_FILTERS}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const ProyectosBudgetList = () => (
  <List
    resource="constructora/proyectos-budget"
    title="Budget de proyectos"
    filters={PROYECTOS_BUDGET_LIST_FILTERS}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "fecha", order: "DESC" }}
    containerClassName={LIST_CONTAINER_XL}
  >
    <ResponsiveDataTable
      rowClick="edit"
      bulkActionButtons={false}
      mobileConfig={{
        primaryField: "proyecto_id",
        secondaryFields: [
          "fecha",
          "proyectos_concepto_id",
          "proyectos_macrorubro_id",
          "importe",
        ],
      }}
      className="text-[9px] [&_th]:text-[9px] [&_td]:text-[9px] xl:text-[10px] xl:[&_th]:text-[10px] xl:[&_td]:text-[10px]"
    >
      <ListColumn source="proyecto_id" label="Proyecto" className="w-[160px] xl:w-[180px]">
        <ReferenceField source="proyecto_id" reference="proyectos" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words max-w-[150px] xl:max-w-[180px]" />
        </ReferenceField>
      </ListColumn>
      <DateListColumn source="fecha" label="Fecha" className="w-[76px]" />
      <ListColumn source="proyectos_concepto_id" label="Concepto" className="w-[120px]">
        <ReferenceField
          source="proyectos_concepto_id"
          reference="constructora/proyectos-conceptos"
          link={false}
        >
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="proyectos_macrorubro_id" label="Macrorubro" className="w-[120px]">
        <ReferenceField
          source="proyectos_macrorubro_id"
          reference="constructora/proyectos-macrorubros"
          link={false}
        >
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="importe" label="Importe" className="w-[110px] text-right">
        <MoneyField source="importe" />
      </ListColumn>
      <ListColumn source="horas" label="Horas" className="w-[70px] text-right">
        <DecimalField source="horas" />
      </ListColumn>
      <ListColumn source="empleados" label="Empl." className="w-[54px] text-right">
        <ListText source="empleados" className="whitespace-nowrap text-right tabular-nums" />
      </ListColumn>
      <ListColumn source="valor_hora" label="Valor hora" className="w-[100px] text-right">
        <MoneyField source="valor_hora" />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[48px] xl:w-[60px]">
        <FormOrderListRowActions />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);
