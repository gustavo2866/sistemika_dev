"use client";

import { FilterButton } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  ListColumn,
  ListDate,
  ListID,
  ListNumber,
  ListPaginator,
  ListStatus,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { List } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";

import type { Vacancia } from "../propiedades/model";

const CICLO_BADGES: Record<string, string> = {
  true: "bg-emerald-100 text-emerald-800",
  false: "bg-slate-200 text-slate-800",
};

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "propiedad_id",
        reference: "propiedades",
        label: "Propiedad",
        perPage: 50,
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todas",
      },
    },
    {
      type: "text",
      props: {
        source: "propiedad.tipo",
        label: "Tipo",
      },
    },
    {
      type: "select",
      props: {
        source: "ciclo_activo",
        label: "Ciclo activo",
        choices: [
          { id: "true", name: "Activas" },
          { id: "false", name: "Cerradas" },
        ],
        className: "w-full",
      },
    },
    {
      type: "text",
      props: {
        source: "fecha_recibida__gte",
        label: "Recibida desde",
        type: "date",
      },
    },
    {
      type: "text",
      props: {
        source: "fecha_recibida__lte",
        label: "Recibida hasta",
        type: "date",
      },
    },
    {
      type: "text",
      props: {
        source: "fecha_alquilada__gte",
        label: "Realizada desde",
        type: "date",
      },
    },
    {
      type: "text",
      props: {
        source: "fecha_alquilada__lte",
        label: "Realizada hasta",
        type: "date",
      },
    },
  ],
  { keyPrefix: "vacancias" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
  </div>
);

export const VacanciaList = () => (
  <List
    title="Vacancias"
    filters={LIST_FILTERS}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    containerClassName="max-w-[980px] w-full mr-auto"
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
  >
    <ResponsiveDataTable
      rowClick="show"
      bulkActionsToolbar={<FormOrderBulkActionsToolbar />}
      mobileConfig={{
        primaryField: "propiedad_id",
        secondaryFields: ["ciclo_activo", "fecha_recibida", "fecha_alquilada", "dias_totales"],
        detailFields: [],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ListColumn source="id" label="ID" className="w-[50px] text-center">
        <ListID source="id" widthClass="w-[50px]" />
      </ListColumn>
      <ListColumn label="Propiedad" className="w-[220px]">
        <ReferenceField source="propiedad_id" reference="propiedades" link={false}>
          <div className="flex flex-col">
            <ListText source="nombre" />
            <span className="text-[9px] text-muted-foreground">
              <ListText source="tipo" />
            </span>
          </div>
        </ReferenceField>
      </ListColumn>
      <ListColumn source="ciclo_activo" label="Estado" className="w-[70px]">
        <ListStatus source="ciclo_activo" statusClasses={CICLO_BADGES} />
      </ListColumn>
      <ListColumn source="fecha_recibida" label="Recibida" className="w-[75px]">
        <ListDate source="fecha_recibida" />
      </ListColumn>
      <ListColumn source="fecha_disponible" label="Disponible" className="w-[75px]">
        <ListDate source="fecha_disponible" />
      </ListColumn>
      <ListColumn source="fecha_alquilada" label="Realizada" className="w-[75px]">
        <ListDate source="fecha_alquilada" />
      </ListColumn>
      <ListColumn source="dias_totales" label="Dias" className="w-[50px] text-right">
        <ListNumber source="dias_totales" />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[60px]">
        <FormOrderListRowActions />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);

const toBoolString = (value?: boolean | string | null) => {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
};

export const VacanciasList = VacanciaList;
