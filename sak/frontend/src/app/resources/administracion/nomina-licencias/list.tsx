"use client";

import { useState } from "react";
import { useFieldValue, useRecordContext } from "ra-core";
import { ClipboardList } from "lucide-react";

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
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { SelectField } from "@/components/select-field";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ParteDiarioPopup } from "@/app/resources/constructora/parte-diario";

import { TIPO_NOVEDAD_CHOICES, type NominaLicencia } from "./model";

type NominaChoice = {
  apellido?: string | null;
  nombre?: string | null;
};

const getNominaLabel = (choice?: unknown) => {
  const record = choice as NominaChoice | undefined;
  return [record?.apellido, record?.nombre]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");
};

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar licencias",
        alwaysOn: true,
        className: "w-[130px] sm:w-[180px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "nomina_id",
        reference: "nominas",
        label: "Empleado",
      },
      selectProps: {
        optionText: getNominaLabel,
        emptyText: "Todos",
        className: "w-full",
      },
    },
    {
      type: "select",
      props: {
        source: "tipo_novedad",
        label: "Tipo",
        choices: TIPO_NOVEDAD_CHOICES,
        emptyText: "Todos",
      },
    },
    {
      type: "text",
      props: {
        source: "fecha_desde__gte",
        label: "Desde",
        type: "date",
      },
    },
    {
      type: "text",
      props: {
        source: "fecha_hasta__lte",
        label: "Hasta",
        type: "date",
      },
    },
  ],
  { keyPrefix: "nomina-licencias" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const NominaNombreField = () => {
  const record = useRecordContext<NominaChoice>();
  return <span className="whitespace-normal break-words">{getNominaLabel(record) || "-"}</span>;
};

const DocumentosCountField = () => {
  const value = useFieldValue({ source: "documentos" });
  const count = Array.isArray(value) ? value.length : 0;
  return <span>{count || "-"}</span>;
};

const NominaLicenciaRowActions = ({ embedded }: { embedded: boolean }) => {
  const record = useRecordContext<NominaLicencia>();
  const [open, setOpen] = useState(false);
  const licenciaId = Number(record?.id);
  const hasLicencia = Number.isInteger(licenciaId) && licenciaId > 0;

  return (
    <>
      <FormOrderListRowActions
        showShow={!embedded}
        extraMenuItems={
          <DropdownMenuItem
            disabled={!hasLicencia}
            data-row-click="ignore"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (hasLicencia) setOpen(true);
            }}
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <ClipboardList className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Novedades
          </DropdownMenuItem>
        }
        extraMenuItemsPosition="before"
      />
      <ParteDiarioPopup
        licencia_id={hasLicencia ? licenciaId : null}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
};

type NominaLicenciaListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
};

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={LIST_FILTERS} size="sm" buttonClassName={ACTION_BUTTON_CLASS} />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" to={createTo} />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

export const NominaLicenciaList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
  createTo,
}: NominaLicenciaListProps = {}) => (
  <List
    resource="nomina-licencias"
    title="Licencias de nómina"
    filters={LIST_FILTERS}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "fecha_desde", order: "DESC" }}
    containerClassName={LIST_CONTAINER_WIDE}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "nomina_id",
        secondaryFields: ["tipo_novedad", "fecha_desde", "fecha_hasta"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ListColumn source="nomina_id" label="Empleado" className="w-[190px]">
        <ReferenceField source="nomina_id" reference="nominas" link={false}>
          <NominaNombreField />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="tipo_novedad" label="Tipo" className="w-[110px]">
        <SelectField source="tipo_novedad" choices={TIPO_NOVEDAD_CHOICES} />
      </ListColumn>
      <DateListColumn source="fecha_desde" label="Desde" className="w-[95px]" />
      <DateListColumn source="fecha_hasta" label="Hasta" className="w-[95px]" />
      <TextListColumn source="comentario" label="Comentario">
        <ListText source="comentario" className="whitespace-normal break-words" />
      </TextListColumn>
      <ListColumn source="documentos" label="Docs." className="w-[60px] text-center">
        <DocumentosCountField />
      </ListColumn>
      <TextListColumn label="Acciones" className="w-[56px]">
        <NominaLicenciaRowActions embedded={embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default NominaLicenciaList;
