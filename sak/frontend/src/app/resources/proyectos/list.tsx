"use client";

import { List } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FormOrderListRowActions } from "@/components/forms/form_order";
import {
  ListPaginator,
  ListText,
  ListDate,
  ListMoney,
  NumberListColumn,
  TextListColumn,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar proyectos",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "text",
      props: {
        source: "estado",
        label: "Estado",
      },
    },
  ],
  { keyPrefix: "proyectos" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

export const ProyectoList = () => (
  <List
    title="Proyectos"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={10}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName="max-w-[900px] w-full mr-auto"
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["estado", "fecha_inicio", "fecha_final"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <NumberListColumn source="id" label="ID" className="text-center" widthClass="w-[80px]" />
      <TextListColumn source="nombre" label="Nombre" disableSort>
        <ListText source="nombre" />
      </TextListColumn>
      <TextListColumn source="estado" label="Estado" widthClass="w-[70px]">
        <ListText source="estado" />
      </TextListColumn>
      <TextListColumn source="fecha_inicio" label="Inicio" widthClass="w-[70px]">
        <ListDate source="fecha_inicio" />
      </TextListColumn>
      <TextListColumn source="fecha_final" label="Finalizacion" widthClass="w-[90px]">
        <ListDate source="fecha_final" />
      </TextListColumn>
      <TextListColumn source="importe_mat" label="Importe MAT">
        <ListMoney source="importe_mat" showCurrency={false} />
      </TextListColumn>
      <TextListColumn source="importe_mo" label="Importe MO">
        <ListMoney source="importe_mo" showCurrency={false} />
      </TextListColumn>
      <TextListColumn label="Acciones">
        <FormOrderListRowActions />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
