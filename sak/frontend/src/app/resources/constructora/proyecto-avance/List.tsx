"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListColumn,
  ListMoney,
  ListNumber,
  ListPaginator,
  ListText,
  ListTextarea,
  NumberListColumn,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar por comentario",
        alwaysOn: true,
        className: "w-[140px] sm:w-[180px]",
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
      type: "text",
      props: {
        source: "fecha_registracion",
        label: "Fecha",
        type: "date",
      },
    },
  ],
  { keyPrefix: "proyecto-avance" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={filters}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const ProyectoAvanceList = () => (
  <List
    title="Certificados"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "fecha_registracion", order: "DESC" }}
    containerClassName={LIST_CONTAINER_WIDE}
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "fecha_registracion",
        secondaryFields: ["proyecto_id", "avance", "horas", "importe"],
      }}
    >
      <NumberListColumn source="id" label="ID" className="w-[80px] text-center" />
      <ListColumn source="proyecto_id" label="Proyecto" className="w-[220px]">
        <ReferenceField source="proyecto_id" reference="proyectos" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words max-w-[220px]" />
        </ReferenceField>
      </ListColumn>
      <DateListColumn source="fecha_registracion" label="Fecha" className="w-[110px]" />
      <ListColumn source="avance" label="Avance %" className="w-[110px] text-right">
        <ListNumber
          source="avance"
          className="whitespace-nowrap text-right tabular-nums"
          options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
        />
      </ListColumn>
      <ListColumn source="horas" label="Horas" className="w-[100px] text-right">
        <ListNumber
          source="horas"
          className="whitespace-nowrap text-right tabular-nums"
          options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
        />
      </ListColumn>
      <ListColumn source="importe" label="Importe" className="w-[120px] text-right">
        <ListMoney
          source="importe"
          showCurrency={false}
          className="whitespace-nowrap text-right"
        />
      </ListColumn>
      <ListColumn source="comentario" label="Comentario" className="min-w-[240px]">
        <ListTextarea source="comentario" maxLength={100} />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[60px]">
        <FormOrderListRowActions />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);
