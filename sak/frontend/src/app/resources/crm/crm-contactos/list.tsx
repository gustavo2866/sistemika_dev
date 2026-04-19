"use client";

import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderListRowActions,
  IdentityFilterSync,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
  useIdentityFilterDefaults,
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

const CRMContactoListActions = ({ returnTo }: { returnTo?: string }) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      {returnTo ? (
        <Button
          type="button"
          variant="ghost"
          className={listActionButtonClass}
          onClick={() => navigate(returnTo)}
        >
          <ArrowLeft className="h-3 w-3" />
          Volver
        </Button>
      ) : null}
      <FilterButton
        filters={listFilters}
        size="sm"
        buttonClassName={listActionButtonClass}
      />
      <CreateButton className={listActionButtonClass} label="Crear" />
      <ExportButton className={listActionButtonClass} label="Exportar" />
    </div>
  );
};

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
  const { identityId, defaultFilters } = useIdentityFilterDefaults({
    source: "responsable_id",
  });
  const location = useLocation();
  const returnTo = getReturnToFromLocation(location);

  return (
    <List
      title="CRM - Contactos"
      filters={listFilters}
      actions={<CRMContactoListActions returnTo={returnTo} />}
      debounce={300}
      perPage={perPage}
      pagination={<ListPaginator />}
      sort={{ field: "nombre_completo", order: "ASC" }}
      containerClassName={LIST_CONTAINER_STANDARD_PLUS}
      filterDefaultValues={defaultFilters}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
    >
      {identityId ? (
        <IdentityFilterSync identityId={identityId} source="responsable_id" />
      ) : null}
      <ResponsiveDataTable
        rowClick={rowClick}
        mobileConfig={{
          primaryField: "nombre_completo",
          secondaryFields: ["telefonos", "email"],
          detailFields: ["responsable_id"],
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
