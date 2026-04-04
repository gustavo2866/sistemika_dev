"use client";

import { useRecordContext } from "ra-core";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListColumn,
  ListNumber,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";

const AvanceMillionsField = ({ source }: { source: string }) => {
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

export const PROYECTO_AVANCE_LIST_FILTERS = buildListFilters(
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

export const PROYECTO_AVANCE_EMBEDDED_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar",
        alwaysOn: true,
        className: "w-[150px] sm:w-[190px]",
      },
    },
  ],
  { keyPrefix: "proyecto-avance-embedded" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={PROYECTO_AVANCE_LIST_FILTERS}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

type ProyectoAvanceListProps = {
  embedded?: boolean;
  filterDefaultValues?: Record<string, unknown>;
  createTo?: string;
  storeKey?: string;
};

export const ProyectoAvanceList = ({
  embedded = false,
  filterDefaultValues,
  createTo,
  storeKey,
}: ProyectoAvanceListProps = {}) => {
  const embeddedActions = embedded ? (
    <div className="flex items-center gap-2">
      <FilterButton
        filters={PROYECTO_AVANCE_EMBEDDED_FILTERS}
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
      resource="proyecto-avance"
      title={embedded ? undefined : "Certificados"}
      filters={embedded ? PROYECTO_AVANCE_EMBEDDED_FILTERS : PROYECTO_AVANCE_LIST_FILTERS}
      actions={embedded ? embeddedActions : <ListActions />}
      debounce={300}
      perPage={25}
      pagination={<ListPaginator />}
      sort={{ field: "fecha_registracion", order: "DESC" }}
      containerClassName={embedded ? "w-full min-w-0" : LIST_CONTAINER_WIDE}
      filterDefaultValues={filterDefaultValues}
      disableSyncWithLocation={embedded}
      storeKey={storeKey}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      filterFormComponent={embedded ? StyledFilterDiv : undefined}
    >
      <ProyectoAvanceListBody showProjectColumn={!embedded} />
    </List>
  );
};

type ProyectoAvanceListBodyProps = {
  compact?: boolean;
  showProjectColumn?: boolean;
};

export const ProyectoAvanceListBody = ({
  compact = false,
  showProjectColumn = true,
}: ProyectoAvanceListBodyProps) => (
  <ResponsiveDataTable
    rowClick="edit"
    compact={compact}
    bulkActionButtons={false}
    mobileConfig={{
      primaryField: "fecha_registracion",
      secondaryFields: ["proyecto_id", "avance", "horas", "importe"],
    }}
    className="text-[8px] [&_th]:text-[8px] [&_td]:text-[8px] xl:text-[9px] xl:[&_th]:text-[9px] xl:[&_td]:text-[9px]"
  >
    <NumberListColumn source="id" label="ID" className="w-[64px] text-center xl:w-[80px]" />
    {showProjectColumn ? (
      <ListColumn source="proyecto_id" label="Proyecto" className="w-[160px] xl:w-[220px]">
        <ReferenceField source="proyecto_id" reference="proyectos" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words max-w-[150px] xl:max-w-[220px]" />
        </ReferenceField>
      </ListColumn>
    ) : null}
    <DateListColumn source="fecha_registracion" label="Fecha" className="w-[62px] xl:w-[70px]" />
    <ListColumn source="avance" label="Avance %" className="w-[60px] xl:w-[68px] text-right">
      <ListNumber
        source="avance"
        className="whitespace-nowrap text-right tabular-nums"
        options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
      />
    </ListColumn>
    <ListColumn source="horas" label="Horas" className="w-[48px] xl:w-[54px] text-right">
      <ListNumber
        source="horas"
        className="whitespace-nowrap text-right tabular-nums"
        options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
      />
    </ListColumn>
    <ListColumn source="importe" label="Importe" className="w-[60px] xl:w-[68px] text-right">
      <AvanceMillionsField source="importe" />
    </ListColumn>
    <ListColumn source="comentario" label="Comentario" className="w-[140px] xl:w-[164px]">
      <ListText
        source="comentario"
        className="block w-[140px] max-w-[140px] truncate whitespace-nowrap xl:w-[164px] xl:max-w-[164px]"
      />
    </ListColumn>
    <ListColumn label="Acciones" className="w-[48px] xl:w-[60px]">
      <FormOrderListRowActions
        className={compact ? "h-4 w-4 sm:h-4 sm:w-4" : undefined}
      />
    </ListColumn>
  </ResponsiveDataTable>
);
