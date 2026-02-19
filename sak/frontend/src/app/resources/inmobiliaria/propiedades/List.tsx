"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  ListColumn,
  ListEstado,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
  ListPaginator,
} from "@/components/forms/form_order";
import { List } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";

import { PROPIEDAD_STATUS_BADGES } from "./model";


// === Filtros ===
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
      type: "text",
      props: {
        source: "propietario",
        label: "Propietario",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "tipo_operacion_id",
        reference: "crm/catalogos/tipos-operacion",
        label: "Tipo operacion",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-full",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "propiedad_status_id",
        reference: "propiedades-status",
        label: "Estado",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-full",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "emprendimiento_id",
        reference: "emprendimientos",
        label: "Emprendimiento",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-full",
      },
    },
  ],
  { keyPrefix: "propiedades-inmobiliaria" },
);

// === Acciones ===
const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const AccionesLista = () => (
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


// === Listado ===
export const PropiedadList = () => <ListaPropiedades />;

const ListaPropiedades = () => (
  <List
    title="Propiedades"
    filters={LIST_FILTERS}
    actions={<AccionesLista />}
    debounce={300}
    perPage={10}
    containerClassName="max-w-[980px] w-full mr-auto"
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
  >
    <ResponsiveDataTable
      rowClick="edit"
      bulkActionsToolbar={<FormOrderBulkActionsToolbar />}
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: [
          "propietario",
          "propiedad_status_id",
          "valor_alquiler",
        ],
        detailFields: [],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ListColumn source="id" label="ID" className="w-[60px]">
        <ListText source="id" />
      </ListColumn>
      <ListColumn source="nombre" label="Nombre" className="w-[180px]">
        <div className="flex flex-col gap-0.5">
          <ListText source="nombre" className="font-medium" />
          <ListText source="propietario" className="text-[9px] text-muted-foreground" />
        </div>
      </ListColumn>
      <ListColumn source="tipo_propiedad_id" label="Tipo prop." className="w-[140px]">
        <ReferenceField
          source="tipo_propiedad_id"
          reference="tipos-propiedad"
          link={false}
          emptyText="Sin asignar"
        >
          <ListText source="nombre" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="tipo_operacion_id" label="Operacion" className="w-[150px]">
        <ReferenceField
          source="tipo_operacion_id"
          reference="crm/catalogos/tipos-operacion"
          link={false}
          emptyText="Sin asignar"
        >
          <ListText source="nombre" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="propiedad_status_id" label="Estado" className="w-[90px]">
        <ListEstado
          source="propiedad_status.nombre"
          statusClasses={PROPIEDAD_STATUS_BADGES}
        />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[60px]">
        <FormOrderListRowActions
          showShow={false}
          showDelete
        />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);
