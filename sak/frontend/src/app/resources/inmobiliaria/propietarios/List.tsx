"use client";

import { List, LIST_CONTAINER_STANDARD } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import {
  CompactSoloActivasToggleFilter,
  FormOrderListRowActions,
} from "@/components/forms/form_order";
import {
  BooleanListColumn,
  ListPaginator,
  NumberListColumn,
  TextListColumn,
  ListText,
  ListTextarea,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { ReferenceField } from "@/components/reference-field";
import { CENTROS_COSTO_REFERENCE, CONCEPTOS_REFERENCE } from "./model";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar propietarios",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "text",
      props: {
        source: "nombre",
        label: "Nombre",
      },
    },
    {
      type: "custom",
      element: (
        <CompactSoloActivasToggleFilter
          key="activo"
          source="activo"
          label="Activos"
          alwaysOn
          className="ml-auto"
        />
      ),
    },
  ],
  { keyPrefix: "propietarios" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const PropietarioList = () => (
  <List
    title="Propietarios"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={10}
    filterDefaultValues={{ activo: true }}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName={LIST_CONTAINER_STANDARD}
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["comentario", "adm_concepto_id", "centro_costo_id", "activo"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <NumberListColumn source="id" label="ID" className="text-center" />
      <TextListColumn source="nombre" label="Nombre">
        <ListText source="nombre" />
      </TextListColumn>
      <TextListColumn source="adm_concepto_id" label="Concepto">
        <ReferenceField source="adm_concepto_id" reference={CONCEPTOS_REFERENCE.resource} link={false}>
          <ListText source={CONCEPTOS_REFERENCE.labelField} />
        </ReferenceField>
      </TextListColumn>
      <TextListColumn source="centro_costo_id" label="Centro costo">
        <ReferenceField
          source="centro_costo_id"
          reference={CENTROS_COSTO_REFERENCE.resource}
          link={false}
        >
          <ListText source={CENTROS_COSTO_REFERENCE.labelField} />
        </ReferenceField>
      </TextListColumn>
      <TextListColumn source="comentario" label="Comentario">
        <ListTextarea source="comentario" maxLength={60} />
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" />
      <TextListColumn label="Acciones">
        <FormOrderListRowActions />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
