"use client";

import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { SelectField } from "@/components/select-field";
import { ReferenceField } from "@/components/reference-field";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { useRecordContext } from "ra-core";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  ListColumn,
  ListDate,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";
import { estadoParteChoices } from "./constants";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar partes diarios",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "idproyecto",
        reference: "proyectos",
        label: "Proyecto",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: estadoParteChoices,
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "parte-diario" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const listMobileConfig = {
  primaryField: "fecha",
  secondaryFields: ["idproyecto", "estado", "descripcion"],
};

type ParteDiarioListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
};

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

const ParteDiarioListTitle = ({ onBack }: { onBack: () => void }) => (
  <span className="inline-flex items-center gap-3">
    <Button
      type="button"
      variant="ghost"
      className="h-8 px-2 text-sm font-medium text-primary"
      onClick={onBack}
    >
      <ArrowLeft className="mr-1 h-3.5 w-3.5" />
      Volver
    </Button>
    <span>Partes diarios</span>
  </span>
);

const DetalleCountField = () => {
  const record = useRecordContext<{ detalles?: Array<unknown> }>();
  const count = Array.isArray(record?.detalles) ? record.detalles.length : 0;
  return <span>{count}</span>;
};

export const ParteDiarioList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 25,
}: ParteDiarioListProps = {}) => {
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
    navigate("/parte-diario");
  };

  return (
    <List
      resource="parte-diario"
      title={embedded ? undefined : <ParteDiarioListTitle onBack={handleBack} />}
      filters={filters}
      actions={embedded ? undefined : <ListActions />}
      perPage={perPage}
      pagination={<ListPaginator />}
      sort={{ field: "fecha", order: "DESC" }}
      containerClassName={embedded ? "w-full min-w-0" : LIST_CONTAINER_WIDE}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      disableSyncWithLocation={embedded}
    >
      <ResponsiveDataTable
        rowClick={rowClick}
        bulkActionsToolbar={!embedded ? <FormOrderBulkActionsToolbar /> : undefined}
        bulkActionButtons={embedded ? false : undefined}
        compact={embedded}
        mobileConfig={listMobileConfig}
        className="text-[10px] [&_th]:text-[10px] [&_td]:text-[10px] xl:text-[11px] xl:[&_th]:text-[11px] xl:[&_td]:text-[11px]"
      >
        <ListColumn source="fecha" label="Fecha" className="w-[120px]">
          <ListDate source="fecha" />
        </ListColumn>
        <ListColumn source="idproyecto" label="Proyecto" className="w-[180px]">
          <ReferenceField source="idproyecto" reference="proyectos" link={false}>
            <ListText source="nombre" className="whitespace-normal break-words" />
          </ReferenceField>
        </ListColumn>
        <ListColumn source="estado" label="Estado" className="w-[110px]">
          <SelectField source="estado" choices={estadoParteChoices} />
        </ListColumn>
        <ListColumn source="descripcion" label="Descripcion" className="w-[220px]">
          <ListText source="descripcion" className="whitespace-normal break-words" />
        </ListColumn>
        <ListColumn label="Registros" className="w-[80px] text-center">
          <DetalleCountField />
        </ListColumn>
        <ListColumn label="" className="w-[30px]">
          <FormOrderListRowActions
            showShow={!embedded}
            className={embedded ? "h-4 w-4 sm:h-4 sm:w-4" : undefined}
          />
        </ListColumn>
      </ResponsiveDataTable>
    </List>
  );
};

export default ParteDiarioList;
