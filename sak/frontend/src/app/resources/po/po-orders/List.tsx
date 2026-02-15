"use client";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  IdentityFilterSync,
  ListColumn,
  ListEstado,
  ListID,
  ListMoney,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
  useIdentityFilterDefaults,
} from "@/components/forms/form_order";
import { List } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";

import { FormConfirmar } from "./form_confirmar";
import { ORDER_STATUS_BADGES } from "./model";

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
        className: "w-[100px] sm:w-[140px]",
      },
    },
    {
      type: "text",
      props: {
        source: "titulo",
        label: "Titulo",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "solicitante_id",
        reference: "users",
        label: "Solicitante",
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
        source: "tipo_solicitud_id",
        reference: "tipos-solicitud",
        label: "Tipo solicitud",
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
        source: "proveedor_id",
        reference: "proveedores",
        label: "Proveedor",
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
        source: "order_status_id",
        reference: "po-order-status",
        label: "Estado",
        sort: { field: "orden", order: "ASC" },
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "po-orders" },
);

// === Acciones ===
const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

// Acciones de toolbar del listado de ordenes.
const AccionesListaOrdenes = () => (
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
// Listado principal de ordenes de compra.
export const PoOrderList = () => <ListaOrdenes />;

// Contenedor con defaults y configuracion del listado.
const ListaOrdenes = () => {
  const { identityId, defaultFilters } = useIdentityFilterDefaults({
    source: "solicitante_id",
  });

  return (
    <List
      title="Ordenes"
      filters={LIST_FILTERS}
      actions={<AccionesListaOrdenes />}
      debounce={300}
      perPage={10}
      containerClassName="max-w-[900px] w-full mr-auto"
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      filterDefaultValues={defaultFilters}
    >
      <IdentityFilterSync identityId={identityId} source="solicitante_id" />
      <ResponsiveDataTable
        rowClick="edit"
        bulkActionsToolbar={<FormOrderBulkActionsToolbar />}
        mobileConfig={{
          primaryField: "titulo",
          secondaryFields: [
            "solicitante_id",
            "tipo_solicitud_id",
            "proveedor_id",
            "total",
          ],
          detailFields: [],
        }}
        className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
      >
        <ListColumn source="id" label="ID" className="w-[45px] text-center">
          <ListID source="id" widthClass="w-[45px]" className="whitespace-normal break-words" />
        </ListColumn>
        <ListColumn source="titulo" label="Titulo" className="w-[120px]">
          <ListText source="titulo" className="whitespace-normal break-words" />
        </ListColumn>
        <ListColumn source="solicitante_id" label="Solicitante" className="w-[90px]">
          <ReferenceField source="solicitante_id" reference="users" link={false}>
            <ListText source="nombre" width="15ch" className="whitespace-normal break-words" />
          </ReferenceField>
        </ListColumn>
        <ListColumn source="tipo_solicitud_id" label="Tipo solicitud" className="w-[90px]">
          <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud" link={false}>
            <ListText source="nombre" width="15ch" className="whitespace-normal break-words" />
          </ReferenceField>
        </ListColumn>
        <ListColumn source="proveedor_id" label="Proveedor" className="w-[90px]">
          <ReferenceField source="proveedor_id" reference="proveedores" link={false}>
            <ListText source="nombre" width="15ch" className="whitespace-normal break-words" />
          </ReferenceField>
        </ListColumn>
        <ListColumn source="order_status_id" label="Estado" className="w-[75px]">
          <ListEstado source="order_status.nombre" statusClasses={ORDER_STATUS_BADGES} />
        </ListColumn>
        <ListColumn source="total" label="Importe" className="w-[90px] text-right">
          <ListMoney source="total" showCurrency={false} className="whitespace-nowrap" />
        </ListColumn>
        <ListColumn label="Acciones" className="w-[60px]">
          <FormOrderListRowActions
            extraMenuItems={
              <>
                <FormConfirmar action="approve" />
                <FormConfirmar action="reject" />
              </>
            }
          />
        </ListColumn>
      </ResponsiveDataTable>
    </List>
  );
};

// === Helpers ===
// (sin helpers locales)
