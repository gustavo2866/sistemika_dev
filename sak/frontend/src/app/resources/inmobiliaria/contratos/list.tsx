"use client";

import { useRecordContext } from "ra-core";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import {
  FormOrderListRowActions,
  ListColumn,
  ListDate,
  ListEstado,
  ListText,
  ListPaginator,
  ResponsiveDataTable,
  buildListFilters,
} from "@/components/forms/form_order";
import { ReferenceField } from "@/components/reference-field";

import { CONTRATO_ESTADO_BADGES, isContratoVencido, type Contrato } from "./model";
import {
  ContratoAccionesDialogs,
  ContratoAccionesMenuItems,
  useContratoAccionesState,
} from "./contrato_acciones";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar contratos",
        alwaysOn: true,
        className: "w-[120px] sm:w-[200px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "propiedad_id",
        reference: "propiedades",
        label: "Propiedad",
      },
      selectProps: { optionText: "nombre", emptyText: "Todas", className: "w-full" },
    },
    {
      type: "reference",
      referenceProps: {
        source: "tipo_contrato_id",
        reference: "tipos-contrato",
        label: "Tipo",
      },
      selectProps: { optionText: "nombre", emptyText: "Todos", className: "w-full" },
    },
    {
      type: "text",
      props: { source: "estado", label: "Estado" },
    },
  ],
  { keyPrefix: "contratos" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

const InquilinoCell = () => {
  const record = useRecordContext<Contrato>();
  if (!record) return null;
  const nombre = [record.inquilino_nombre, record.inquilino_apellido].filter(Boolean).join(" ");
  return <span className="text-[11px]">{nombre || "—"}</span>;
};
// La celda de acciones gestiona su propio estado de di\u00e1logos FUERA del dropdown,
// para evitar que el estado se pierda cuando el men\u00fa se desmonta al cerrarse.
const ContratoAccionesCell = () => {
  const record = useRecordContext<Contrato>();
  const acciones = useContratoAccionesState(record);
  return (
    <>
      <FormOrderListRowActions
        showShow
        extraMenuItems={<ContratoAccionesMenuItems acciones={acciones} />}
      />
      {record?.id ? <ContratoAccionesDialogs acciones={acciones} /> : null}
    </>
  );
};

const EstadoCell = () => {
  const record = useRecordContext<Contrato>();
  if (!record) return null;
  // vencido es computed: vigente con fecha_vencimiento < hoy
  const displayEstado = isContratoVencido(record) ? "vencido" : (record.estado ?? "");
  return <ListEstado source="estado" statusClasses={CONTRATO_ESTADO_BADGES} record={{ ...record, estado: displayEstado }} />;
};
export const ContratoList = () => (
  <List
    title="Contratos"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={10}
    containerClassName={LIST_CONTAINER_WIDE}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "id",
        secondaryFields: ["estado", "inquilino_nombre"],
        detailFields: [],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ListColumn source="id" label="ID" className="w-[60px]">
        <ListText source="id" />
      </ListColumn>
      <ListColumn source="propiedad_id" label="Propiedad" className="w-[160px]">
        <ReferenceField source="propiedad_id" reference="propiedades" link="show">
          <ListText source="nombre" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="tipo_contrato_id" label="Tipo" className="w-[100px]">
        <ReferenceField source="tipo_contrato_id" reference="tipos-contrato" link={false}>
          <ListText source="nombre" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="inquilino_nombre" label="Inquilino" className="w-[120px]">
        <InquilinoCell />
      </ListColumn>
      <ListColumn source="estado" label="Estado" className="w-[80px]">
        <EstadoCell />
      </ListColumn>
      <ListColumn source="fecha_inicio" label="Inicio" className="w-[90px]">
        <ListDate source="fecha_inicio" />
      </ListColumn>
      <ListColumn source="fecha_vencimiento" label="Vencimiento" className="w-[100px]">
        <ListDate source="fecha_vencimiento" />
      </ListColumn>
      <ListColumn source="valor_alquiler" label="Alquiler" className="w-[100px]">
        <ListText source="valor_alquiler" />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[60px]">
        <ContratoAccionesCell />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);
