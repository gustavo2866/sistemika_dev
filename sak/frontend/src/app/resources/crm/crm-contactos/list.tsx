"use client";

import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { List } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ReferenceField } from "@/components/reference-field";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import {
  FormOrderListRowActions,
  IdentityFilterSync,
  ListColumn,
  ListID,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
  useIdentityFilterDefaults,
} from "@/components/forms/form_order";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";

const LIST_FILTERS = buildListFilters(
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
  ],
  { keyPrefix: "crm-contactos" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ContactoListActions = ({ returnTo }: { returnTo?: string }) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      {returnTo ? (
        <Button
          type="button"
          variant="ghost"
          className={ACTION_BUTTON_CLASS}
          onClick={() => navigate(returnTo)}
        >
          <ArrowLeft className="h-3 w-3" />
          Volver
        </Button>
      ) : null}
      <FilterButton filters={LIST_FILTERS} size="sm" buttonClassName={ACTION_BUTTON_CLASS} />
      <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" />
      <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
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
  perPage = 10,
}: CRMContactoListProps = {}) => (
  <ListaContactos embedded={embedded} rowClick={rowClick} perPage={perPage} />
);

const ListaContactos = ({
  embedded,
  rowClick,
  perPage,
}: {
  embedded: boolean;
  rowClick: any;
  perPage: number;
}) => {
  const { identityId, defaultFilters } = useIdentityFilterDefaults({
    source: "responsable_id",
  });
  const location = useLocation();
  const returnTo = getReturnToFromLocation(location);

  return (
    <List
      title="Contactos"
      filters={LIST_FILTERS}
      actions={<ContactoListActions returnTo={returnTo} />}
      debounce={300}
      perPage={perPage}
      pagination={<ListPaginator />}
      sort={{ field: "nombre_completo", order: "ASC" }}
      containerClassName="max-w-[900px] w-full mr-auto"
      filterDefaultValues={defaultFilters}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
    >
      <CRMContactoListBody identityId={identityId} rowClick={rowClick} />
    </List>
  );
};

const CRMContactoListBody = ({
  identityId,
  rowClick,
}: {
  identityId?: number | string;
  rowClick: any;
}) => (
  <>
    {identityId ? (
      <IdentityFilterSync identityId={identityId} source="responsable_id" />
    ) : null}
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "nombre_completo",
        secondaryFields: ["email", "telefonos", "responsable_id"],
        detailFields: [],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ListColumn source="id" label="ID" className="w-[70px] min-w-[70px] text-center">
        <ListID source="id" widthClass="w-[45px]" className="whitespace-normal break-words" />
      </ListColumn>
      <ListColumn source="nombre_completo" label="Nombre" className="min-w-[260px]">
        <ListText source="nombre_completo" className="whitespace-normal break-words max-w-[420px]" />
      </ListColumn>
      <ListColumn source="telefonos" label="Telefonos">
        <TextField source="telefonos" className="whitespace-normal break-words max-w-[220px]" />
      </ListColumn>
      <ListColumn source="responsable_id" label="Responsable">
        <ReferenceField source="responsable_id" reference="users" link={false}>
          <ListText source="nombre" />
        </ReferenceField>
      </ListColumn>
      <ListColumn label="Acciones" className="w-[60px]">
        <FormOrderListRowActions />
      </ListColumn>
    </ResponsiveDataTable>
  </>
);
