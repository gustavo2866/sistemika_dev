"use client";

import { useRecordContext } from "ra-core";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { List, LIST_CONTAINER_STANDARD } from "@/components/list";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListDate,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { getProyectoUltimoAvance } from "./model";

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar proyectos",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "text",
      props: {
        source: "estado",
        label: "Estado",
      },
    },
    {
      type: "text",
      props: {
        source: "centro_costo",
        label: "Centro de costo",
      },
    },
  ],
  { keyPrefix: "proyectos" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ProyectoListTitle = ({ onBack }: { onBack: () => void }) => (
  <>
    <div className="sm:hidden">
      <Button
        type="button"
        variant="ghost"
        className="h-7 px-1.5 text-[11px] font-medium text-primary"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Volver
      </Button>
      <div className="-mt-0.5 flex items-center justify-center">
        <span>Proyectos</span>
      </div>
    </div>
    <span className="hidden items-center gap-3 sm:inline-flex">
      <Button
        type="button"
        variant="ghost"
        className="h-8 px-2 text-sm font-medium text-primary"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Volver
      </Button>
      <span>Proyectos</span>
    </span>
  </>
);

type ProyectoListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
};

const ListActions = () => (
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

const UltimoAvanceField = () => {
  const record = useRecordContext<{
    avances?: Array<{ avance?: number; fecha_registracion?: string }>;
  }>();
  const value = getProyectoUltimoAvance(record?.avances);

  return (
    <span>
      {value.toLocaleString("es-AR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}
      %
    </span>
  );
};

const ProyectoListBody = ({
  rowClick,
  embedded,
}: {
  rowClick: any;
  embedded: boolean;
}) => (
  <ResponsiveDataTable
    rowClick={rowClick}
    mobileConfig={{
      primaryField: "nombre",
      secondaryFields: ["estado", "fecha_inicio", "fecha_final"],
    }}
    className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
  >
    <NumberListColumn
      source="id"
      label="ID"
      className="text-center"
      widthClass="w-[80px]"
    />
    <TextListColumn source="nombre" label="Nombre" className="w-[170px]">
      <ListText source="nombre" className="whitespace-normal break-words" />
    </TextListColumn>
    <TextListColumn source="estado" label="Estado" className="w-[90px]">
      <ListText source="estado" />
    </TextListColumn>
    <DateListColumn source="fecha_inicio" label="Inicio" className="w-[80px]">
      <ListDate source="fecha_inicio" />
    </DateListColumn>
    <NumberListColumn
      source="centro_costo"
      label="CCosto"
      className="w-[75px] text-center"
    />
    <NumberListColumn
      source="ingresos"
      label="Ingresos"
      className="w-[95px] text-right"
    />
    <NumberListColumn label="Avance" className="w-[90px] text-center">
      <UltimoAvanceField />
    </NumberListColumn>
    <TextListColumn label="Acciones" className="w-[80px]">
      <FormOrderListRowActions showShow={!embedded} />
    </TextListColumn>
  </ResponsiveDataTable>
);

export const ProyectoList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 10,
}: ProyectoListProps = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = getReturnToFromLocation(location);

  const handleBack = () => {
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/proyectos");
  };

  const embeddedActions = embedded ? (
    <div className="flex items-center gap-2">
      <FilterButton
        filters={LIST_FILTERS}
        size="sm"
        buttonClassName={actionButtonClass}
      />
      <CreateButton className={actionButtonClass} label="Agregar" />
      <ExportButton className={actionButtonClass} label="Exportar" />
    </div>
  ) : undefined;

  return (
    <List
      resource="proyectos"
      title={embedded ? undefined : <ProyectoListTitle onBack={handleBack} />}
      filters={LIST_FILTERS}
      actions={embedded ? embeddedActions : <ListActions />}
      debounce={300}
      perPage={perPage}
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "DESC" }}
      containerClassName={embedded ? "w-full min-w-0" : LIST_CONTAINER_STANDARD}
      disableSyncWithLocation={embedded}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      filterFormComponent={embedded ? StyledFilterDiv : undefined}
    >
      <ProyectoListBody rowClick={rowClick} embedded={embedded} />
    </List>
  );
};
