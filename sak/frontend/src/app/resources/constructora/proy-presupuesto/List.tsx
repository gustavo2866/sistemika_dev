"use client";

import { useRecordContext } from "ra-core";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
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

const PresupuestoMillionsField = ({ source }: { source: string }) => {
  const record = useRecordContext<Record<string, unknown>>();
  const rawValue = Number(record?.[source] ?? 0);
  const valueInMillions = Number.isFinite(rawValue) ? rawValue / 1_000_000 : 0;

  return (
    <NumberField
      source={source}
      record={{ [source]: valueInMillions }}
      options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
      className="whitespace-nowrap text-right tabular-nums"
    />
  );
};

export const PROY_PRESUPUESTO_LIST_FILTERS = buildListFilters(
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

export const PROY_PRESUPUESTO_EMBEDDED_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar",
        alwaysOn: true,
        className: "w-[140px] sm:w-[180px]",
      },
    },
  ],
  { keyPrefix: "proy-presupuestos-embedded" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={PROY_PRESUPUESTO_LIST_FILTERS}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

type ProyPresupuestoListProps = {
  embedded?: boolean;
  filterDefaultValues?: Record<string, unknown>;
  createTo?: string;
  storeKey?: string;
};

export const ProyPresupuestoList = ({
  embedded = false,
  filterDefaultValues,
  createTo,
  storeKey,
}: ProyPresupuestoListProps = {}) => {
  const isEmbedded = embedded;

  const embeddedActions = isEmbedded ? (
    <div className="flex items-center gap-2">
      <FilterButton
        filters={PROY_PRESUPUESTO_EMBEDDED_FILTERS}
        size="sm"
        buttonClassName={actionButtonClass}
      />
      <CreateButton
        to={createTo}
        className={actionButtonClass}
        label="Agregar"
      />
      <ExportButton className={actionButtonClass} label="Exportar" />
    </div>
  ) : undefined;

  return (
    <List
      resource="proy-presupuestos"
      title={isEmbedded ? undefined : "Presupuestos de proyecto"}
      filters={isEmbedded ? PROY_PRESUPUESTO_EMBEDDED_FILTERS : PROY_PRESUPUESTO_LIST_FILTERS}
      actions={isEmbedded ? embeddedActions : <ListActions />}
      debounce={300}
      perPage={25}
      pagination={<ListPaginator />}
      sort={{ field: "fecha", order: "DESC" }}
      containerClassName={isEmbedded ? "w-full min-w-0" : LIST_CONTAINER_XL}
      filterDefaultValues={filterDefaultValues}
      disableSyncWithLocation={isEmbedded}
      storeKey={storeKey}
      showBreadcrumb={!isEmbedded}
      showHeader={!isEmbedded}
      filterFormComponent={isEmbedded ? StyledFilterDiv : undefined}
    >
      <ProyPresupuestoListBody showProjectColumn={!isEmbedded} />
    </List>
  );
};

type ProyPresupuestoListBodyProps = {
  compact?: boolean;
  showProjectColumn?: boolean;
};

export const ProyPresupuestoListBody = ({
  compact = false,
  showProjectColumn = true,
}: ProyPresupuestoListBodyProps) => (
  <ResponsiveDataTable
    rowClick="edit"
    compact={compact}
    bulkActionButtons={false}
    mobileConfig={{
      primaryField: "fecha",
      secondaryFields: ["proyecto_id", "importe", "materiales", "horas"],
    }}
    className="text-[9px] [&_th]:text-[9px] [&_td]:text-[9px] xl:text-[10px] xl:[&_th]:text-[10px] xl:[&_td]:text-[10px]"
  >
    {showProjectColumn ? (
      <ListColumn source="proyecto_id" label="Proyecto" className="w-[160px] xl:w-[180px]">
        <ReferenceField source="proyecto_id" reference="proyectos" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words max-w-[150px] xl:max-w-[180px]" />
        </ReferenceField>
      </ListColumn>
    ) : null}
    <DateListColumn source="fecha" label="Fecha" className="w-[68px] xl:w-[76px]" />
    <ListColumn source="importe" label="Ingresos" className="w-[64px] xl:w-[70px] text-right">
      <PresupuestoMillionsField source="importe" />
    </ListColumn>
    <ListColumn source="mo_propia" label="MO prop." className="w-[64px] xl:w-[70px] text-right">
      <PresupuestoMillionsField source="mo_propia" />
    </ListColumn>
    <ListColumn source="mo_terceros" label="MO terc." className="w-[64px] xl:w-[70px] text-right">
      <PresupuestoMillionsField source="mo_terceros" />
    </ListColumn>
    <ListColumn source="materiales" label="Materiales" className="w-[64px] xl:w-[70px] text-right">
      <PresupuestoMillionsField source="materiales" />
    </ListColumn>
    <ListColumn source="horas" label="Horas" className="w-[58px] xl:w-[66px] text-right">
      <ListText source="horas" className="whitespace-nowrap text-right tabular-nums" />
    </ListColumn>
    <ListColumn source="metros" label="Metros" className="w-[58px] xl:w-[66px] text-right">
      <ListText source="metros" className="whitespace-nowrap text-right tabular-nums" />
    </ListColumn>
    <ListColumn label="Acciones" className="w-[48px] xl:w-[60px]">
      <FormOrderListRowActions
        className={compact ? "h-4 w-4 sm:h-4 sm:w-4" : undefined}
      />
    </ListColumn>
  </ResponsiveDataTable>
);
