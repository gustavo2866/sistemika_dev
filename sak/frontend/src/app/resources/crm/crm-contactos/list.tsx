"use client";

import { ArrowLeft, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderListRowActions,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_STANDARD_PLUS } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";

const listFilters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar contactos",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "text",
      props: {
        source: "email",
        label: "Email",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "responsable_id",
        reference: "users",
        label: "Responsable",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "tipo_id",
        reference: "crm/catalogos/tipos-contacto",
        label: "Tipo",
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "crm-contactos" },
);

const listActionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const CRMContactoListTitle = ({ onBack }: { onBack: () => void }) => (
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
      <div className="-mt-0.5 flex items-center justify-center gap-2">
        <Users className="h-4 w-4" />
        <span>CRM Contactos</span>
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
      <span className="inline-flex items-center gap-2">
        <Users className="h-4 w-4" />
        CRM Contactos
      </span>
    </span>
  </>
);

const CRMContactoListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={listFilters}
      size="sm"
      buttonClassName={listActionButtonClass}
    />
    <CreateButton className={listActionButtonClass} label="Crear" />
    <ExportButton className={listActionButtonClass} label="Exportar" />
  </div>
);

type CRMContactoListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
};

export const CRMContactoList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 5,
}: CRMContactoListProps = {}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleBack = () => {
    const returnTo = getReturnToFromLocation(location);
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/crm");
  };

  return (
    <List
      title={embedded ? "CRM - Contactos" : <CRMContactoListTitle onBack={handleBack} />}
      filters={listFilters}
      actions={<CRMContactoListActions />}
      debounce={300}
      perPage={perPage}
      pagination={<ListPaginator />}
      sort={{ field: "nombre_completo", order: "ASC" }}
      containerClassName={LIST_CONTAINER_STANDARD_PLUS}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
    >
      <ResponsiveDataTable
        rowClick={rowClick}
        mobileConfig={{
          primaryField: "nombre_completo",
          secondaryFields: ["telefonos", "email"],
          detailFields: [{ source: "responsable_id" }],
        }}
        className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
      >
        <TextListColumn source="id" label="ID" className="w-[60px]">
          <ListText source="id" className="tabular-nums" />
        </TextListColumn>
        <TextListColumn source="nombre_completo" label="Nombre" className="w-[220px]">
          <ListText source="nombre_completo" className="whitespace-normal break-words" />
        </TextListColumn>
        <TextListColumn source="telefonos" label="Telefonos" className="w-[170px]">
          <TextField source="telefonos" className="whitespace-normal break-words" />
        </TextListColumn>
        <TextListColumn source="email" label="Email" className="w-[200px]">
          <ListText source="email" className="whitespace-normal break-words" />
        </TextListColumn>
        <TextListColumn source="tipo_id" label="Tipo" className="w-[120px]">
          <ReferenceField source="tipo_id" reference="crm/catalogos/tipos-contacto" link={false}>
            <ListText source="nombre" className="whitespace-normal break-words" />
          </ReferenceField>
        </TextListColumn>
        <TextListColumn label="Acciones" className="w-[80px]">
          <FormOrderListRowActions showShow={!embedded} />
        </TextListColumn>
      </ResponsiveDataTable>
    </List>
  );
};
