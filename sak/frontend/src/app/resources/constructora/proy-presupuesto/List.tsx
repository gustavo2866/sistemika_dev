"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListColumn,
  ListMoney,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_XL } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar por fecha",
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
      type: "text",
      props: {
        source: "fecha",
        label: "Fecha",
        type: "date",
      },
    },
  ],
  { keyPrefix: "proy-presupuestos" },
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

export const ProyPresupuestoList = () => (
  <List
    title="Presupuestos de proyecto"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "fecha", order: "DESC" }}
    containerClassName={LIST_CONTAINER_XL}
  >
    <ProyPresupuestoListBody />
  </List>
);

type ProyPresupuestoListBodyProps = {
  compact?: boolean;
};

export const ProyPresupuestoListBody = ({
  compact = false,
}: ProyPresupuestoListBodyProps) => (
  <ResponsiveDataTable
    rowClick="edit"
    compact={compact}
    bulkActionButtons={false}
    mobileConfig={{
      primaryField: "fecha",
      secondaryFields: ["proyecto_id", "importe", "materiales", "horas"],
    }}
    className="text-[10px] [&_th]:text-[10px] [&_td]:text-[10px] xl:text-[11px] xl:[&_th]:text-[11px] xl:[&_td]:text-[11px]"
  >
    <ListColumn source="proyecto_id" label="Proyecto" className="w-[160px] xl:w-[180px]">
      <ReferenceField source="proyecto_id" reference="proyectos" link={false}>
        <ListText source="nombre" className="whitespace-normal break-words max-w-[150px] xl:max-w-[180px]" />
      </ReferenceField>
    </ListColumn>
    <DateListColumn source="fecha" label="Fecha" className="w-[92px] xl:w-[110px]" />
    <ListColumn source="mo_propia" label="MO prop." className="w-[102px] xl:w-[110px] text-right">
      <ListMoney source="mo_propia" showCurrency={false} className="whitespace-nowrap" />
    </ListColumn>
    <ListColumn source="mo_terceros" label="MO terc." className="w-[102px] xl:w-[110px] text-right">
      <ListMoney source="mo_terceros" showCurrency={false} className="whitespace-nowrap" />
    </ListColumn>
    <ListColumn source="materiales" label="Materiales" className="w-[102px] xl:w-[110px] text-right">
      <ListMoney source="materiales" showCurrency={false} className="whitespace-nowrap" />
    </ListColumn>
    <ListColumn source="importe" label="Importe" className="w-[102px] xl:w-[110px] text-right">
      <ListMoney source="importe" showCurrency={false} className="whitespace-nowrap" />
    </ListColumn>
    <ListColumn source="horas" label="Horas" className="w-[76px] xl:w-[90px] text-right">
      <ListText source="horas" className="whitespace-nowrap text-right tabular-nums" />
    </ListColumn>
    <ListColumn source="metros" label="Metros" className="w-[76px] xl:w-[90px] text-right">
      <ListText source="metros" className="whitespace-nowrap text-right tabular-nums" />
    </ListColumn>
    <ListColumn label="Acciones" className="w-[48px] xl:w-[60px]">
      <FormOrderListRowActions
        className={compact ? "h-4 w-4 sm:h-4 sm:w-4" : undefined}
      />
    </ListColumn>
  </ResponsiveDataTable>
);
