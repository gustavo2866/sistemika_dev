"use client";

import { useNavigate } from "react-router-dom";
import { CalendarRange, ClipboardCheck } from "lucide-react";
import { useRecordContext } from "ra-core";
import { List, LIST_CONTAINER_XL } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { DateField } from "@/components/date-field";
import {
  estadoTarjaChoices,
  getEstadoTarjaBadgeClass,
  getEstadoTarjaLabel,
} from "./constants";

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "reference",
      referenceProps: {
        source: "idproyecto",
        reference: "proyectos",
        label: "Proyecto",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todas",
        className: "w-[170px] sm:w-[210px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "contacto_id",
        reference: "crm/contactos",
        label: "Contacto",
      },
      selectProps: {
        optionText: "nombre_completo",
        emptyText: "Todos",
        className: "w-[170px] sm:w-[210px]",
      },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: estadoTarjaChoices,
        emptyText: "Todos",
        alwaysOn: true,
        className: "w-[110px]",
      },
    },
  ],
  { keyPrefix: "tarjas" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const LIST_MOBILE_CONFIG = {
  primaryField: "idproyecto",
  secondaryFields: ["contacto_id", "fechainicio", "fechafinal", "estado"],
};

type TarjaListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
};

const TarjaListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

const TarjaListTitle = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => navigate("/tarjas/panel")}
        title="Volver al panel de tarjas"
      >
        <CalendarRange className="h-4 w-4" />
      </Button>
      <span className="inline-flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5" />
        Tarjas
      </span>
    </div>
  );
};

const EstadoTarjaField = () => {
  const record = useRecordContext<{ estado?: string | null }>();
  const estado = record?.estado;

  return (
    <Badge
      variant="secondary"
      className={`px-2 py-0.5 text-[10px] font-medium ${getEstadoTarjaBadgeClass(estado)}`}
    >
      {getEstadoTarjaLabel(estado)}
    </Badge>
  );
};

export const TarjaList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 10,
}: TarjaListProps = {}) => (
  <List
    resource="tarjas"
    title={embedded ? undefined : <TarjaListTitle />}
    filters={LIST_FILTERS}
    actions={<TarjaListActions />}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "fechainicio", order: "DESC" }}
    containerClassName={LIST_CONTAINER_XL}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={LIST_MOBILE_CONFIG}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="idproyecto" label="Proyecto" className="w-[180px]">
        <ReferenceField source="idproyecto" reference="proyectos" link={false}>
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </TextListColumn>
      <TextListColumn source="contacto_id" label="Contacto" className="w-[180px]">
        <ReferenceField source="contacto_id" reference="crm/contactos" link={false}>
          <ListText source="nombre_completo" className="whitespace-normal break-words" />
        </ReferenceField>
      </TextListColumn>
      <DateListColumn source="fechainicio" label="Inicio" className="w-[86px]">
        <DateField source="fechainicio" />
      </DateListColumn>
      <DateListColumn source="fechafinal" label="Final" className="w-[86px]">
        <DateField source="fechafinal" />
      </DateListColumn>
      <TextListColumn source="estado" label="Estado" className="w-[92px]">
        <EstadoTarjaField />
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripcion">
        <ListText source="descripcion" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn label="Acciones" className="w-[56px]">
        <FormOrderListRowActions showShow={!embedded} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default TarjaList;
