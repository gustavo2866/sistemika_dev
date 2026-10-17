"use client";

import { useRecordContext } from "ra-core";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  BooleanListColumn,
  FormOrderListRowActions,
  ListNumber,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_STANDARD } from "@/components/list";
import {
  METODO_PROYECCION_ACTIVO_CHOICES,
  type MetodoProyeccion,
} from "./model";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar métodos",
        alwaysOn: true,
      },
    },
    {
      type: "select",
      props: {
        source: "activo",
        label: "Activo",
        choices: METODO_PROYECCION_ACTIVO_CHOICES,
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "metodos-proyeccion" },
);

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" />
    <CreateButton label="Crear" to={createTo} />
    <ExportButton label="Exportar" />
  </div>
);

const DetallesCountField = () => {
  const record = useRecordContext<MetodoProyeccion>();
  return <span>{Array.isArray(record?.detalles) ? record.detalles.length : 0}</span>;
};

type MetodoProyeccionListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
};

export const MetodoProyeccionList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 10,
  createTo,
}: MetodoProyeccionListProps = {}) => (
  <List
    resource="metodos-proyeccion"
    title="Métodos de proyección"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "nombre", order: "ASC" }}
    containerClassName={embedded ? "w-full max-w-none" : LIST_CONTAINER_STANDARD}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["activo"],
        detailFields: [
          { source: "descripcion" },
          {
            source: "detalles",
            format: (value) => `${Array.isArray(value) ? value.length : 0} reglas`,
          },
        ],
      }}
    >
      <TextListColumn source="nombre" label="Nombre" className="w-[260px]">
        <ListText source="nombre" className="whitespace-normal break-words" />
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripción">
        <ListText source="descripcion" className="whitespace-normal break-words" empty="-" />
      </TextListColumn>
      <NumberListColumn source="detalles" label="Reglas" className="w-[80px]">
        <DetallesCountField />
      </NumberListColumn>
      <BooleanListColumn source="activo" label="Activo" className="w-[80px]" />
      <TextListColumn source="id" label="ID" className="w-[70px]">
        <ListNumber source="id" />
      </TextListColumn>
      <TextListColumn label="Acciones" className="w-[64px]">
        <FormOrderListRowActions showShow={false} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
