"use client";

import { List, LIST_CONTAINER_XL } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { FilterButton, StyledFilterDiv } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { useDataProvider, useRecordContext, type Exporter } from "ra-core";
import {
  BooleanListColumn,
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  ListColumn,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { ESTADO_CHOICES } from "./model";
import { NominaBackButton } from "./navigation-title";
import { NominaAsignarEncargadoButton } from "./asignar-encargado";

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar empleados",
        alwaysOn: true,
        className: "w-[130px] sm:w-[180px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "encargado_contacto_id",
        reference: "crm/contactos",
        label: "Encargado",
        filter: { "tipo.nombre": "Encargado" },
      },
      selectProps: {
        optionText: "nombre_completo",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "nomina_categoria_id",
        reference: "nomina-categorias",
        label: "Categoria",
      },
      selectProps: {
        optionText: "descripcion",
        className: "w-full",
        emptyText: "Todas",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "nomina_tarea_id",
        reference: "nomina-tareas",
        label: "Tarea",
      },
      selectProps: {
        optionText: "descripcion",
        className: "w-full",
        emptyText: "Todas",
      },
    },
    {
      type: "select",
      props: {
        source: "activo",
        label: "Estado",
        choices: ESTADO_CHOICES,
        emptyText: "Todos",
      },
    },
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
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "nominas" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

type NominaExportRecord = Record<string, unknown> & {
  id: number;
  apellido?: string | null;
  nombre?: string | null;
  encargado_contacto_id?: number | null;
  proyecto?: { nombre?: string | null } | null;
  nomina_categoria?: { descripcion?: string | null } | null;
  nomina_tarea?: { descripcion?: string | null } | null;
};

const escapeExcelHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const nominaXlsExporter: Exporter<NominaExportRecord> = async (
  records,
  fetchRelatedRecords,
) => {
  const encargados = await fetchRelatedRecords(
    records,
    "encargado_contacto_id",
    "crm/contactos",
  );
  const columns: Array<[string, (record: NominaExportRecord) => unknown]> = [
    ["ID", (record) => record.id],
    ["Legajo", (record) => record.nro_legajo],
    ["Apellido", (record) => record.apellido],
    ["Nombre", (record) => record.nombre],
    ["DNI", (record) => record.dni],
    ["Email", (record) => record.email],
    ["Telefono", (record) => record.telefono],
    ["Direccion", (record) => record.direccion],
    ["Fecha nacimiento", (record) => record.fecha_nacimiento],
    ["Fecha ingreso", (record) => record.fecha_ingreso],
    ["Fecha egreso", (record) => record.fecha_egreso],
    ["Categoria", (record) => record.nomina_categoria?.descripcion],
    ["Tarea", (record) => record.nomina_tarea?.descripcion],
    ["Proyecto", (record) => record.proyecto?.nombre],
    [
      "Encargado",
      (record) =>
        record.encargado_contacto_id == null
          ? ""
          : encargados[record.encargado_contacto_id]?.nombre_completo,
    ],
    ["Activo", (record) => (record.activo ? "Si" : "No")],
    ["Salario mensual", (record) => record.salario_mensual],
  ];
  const header = columns
    .map(([label]) => `<th>${escapeExcelHtml(label)}</th>`)
    .join("");
  const body = records
    .map(
      (record) =>
        `<tr>${columns
          .map(([, getValue]) => `<td>${escapeExcelHtml(getValue(record))}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8" /><style>table{border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:4px;font-family:Arial,sans-serif;font-size:11px}th{background:#e5e7eb;font-weight:600}</style></head><body><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${html}`], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "nomina.xls";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const NombreCompletoField = () => {
  const record = useRecordContext<{ nombre?: string | null; apellido?: string | null }>();
  const apellido = String(record?.apellido ?? "").trim();
  const nombre = String(record?.nombre ?? "").trim();
  const value = [apellido, nombre].filter(Boolean).join(", ");
  return <span className="whitespace-normal break-words">{value || "-"}</span>;
};

const NominaRowActions = ({ rowClick }: { rowClick?: any }) => {
  const dataProvider = useDataProvider();

  const validateDelete = async (record: Record<string, unknown>) => {
    const { total } = await dataProvider.getList("tarja-nomina", {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
      filter: { nomina_id: record.id },
      meta: { suppressErrorNotification: true },
    });
    const totalRegistros = total ?? 0;

    if (totalRegistros > 0) {
      return {
        allowed: false,
        message: `No se puede eliminar: el empleado pertenece a ${totalRegistros} registro${totalRegistros === 1 ? "" : "s"} de Tarja Nomina.`,
      };
    }

    return {
      allowed: true,
      message: "Validacion correcta: el empleado no pertenece a ninguna Tarja Nomina. Deseas eliminarlo?",
    };
  };

  return (
    <FormOrderListRowActions
      showEdit
      showShow={false}
      validateDelete={validateDelete}
      getEditPath={(record) => {
        if (typeof rowClick !== "function") return undefined;
        const path = rowClick(record.id, "nominas", record);
        return typeof path === "string" ? path : undefined;
      }}
    />
  );
};

const NominaListTitle = () => (
  <>
    <div className="sm:hidden">
      <NominaBackButton />
      <div className="-mt-0.5 flex items-center justify-center">
        <span>Nomina</span>
      </div>
    </div>
    <span className="hidden items-center gap-3 sm:inline-flex">
      <NominaBackButton />
      <span>Nomina</span>
    </span>
  </>
);

type NominaListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
  filter?: Record<string, unknown>;
  filterDefaultValues?: Record<string, unknown>;
  storeKey?: string;
};

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" to={createTo} />
    <ExportButton
      className={ACTION_BUTTON_CLASS}
      label="Exportar"
      exporter={nominaXlsExporter}
    />
  </div>
);

export const NominaList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 10,
  createTo,
  filter,
  filterDefaultValues,
  storeKey,
}: NominaListProps = {}) => (
  <List
    resource="nominas"
    title={embedded ? undefined : <NominaListTitle />}
    filters={LIST_FILTERS}
    filterFormComponent={embedded ? StyledFilterDiv : undefined}
    actions={<ListActions createTo={createTo} />}
    filter={filter}
    filterDefaultValues={filterDefaultValues}
    debounce={300}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName={embedded ? "w-full max-w-none" : LIST_CONTAINER_XL}
    disableSyncWithLocation={embedded}
    storeKey={storeKey}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      bulkActionsToolbar={
        <FormOrderBulkActionsToolbar>
          <NominaAsignarEncargadoButton />
        </FormOrderBulkActionsToolbar>
      }
      mobileConfig={{
        primaryField: "apellido",
        secondaryFields: ["nombre", "nomina_categoria_id", "nomina_tarea_id", "idproyecto", "encargado_contacto_id"],
      }}
      className="text-[10px] [&_th]:text-[10px] [&_td]:text-[10px] xl:text-[11px] xl:[&_th]:text-[11px] xl:[&_td]:text-[11px]"
    >
      <NumberListColumn
        source="id"
        label="ID"
        className="w-[50px] text-center"
      />
      <TextListColumn source="apellido" label="Apellido y nombre" className="w-[170px]">
        <NombreCompletoField />
      </TextListColumn>
      <ListColumn source="nomina_categoria_id" label="Categoria" className="w-[150px]">
        <ReferenceField source="nomina_categoria_id" reference="nomina-categorias">
          <ListText source="descripcion" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="nomina_tarea_id" label="Tarea" className="w-[120px]">
        <ReferenceField source="nomina_tarea_id" reference="nomina-tareas">
          <ListText source="descripcion" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="idproyecto" label="Proyecto" className="w-[160px]">
        <ReferenceField source="idproyecto" reference="proyectos">
          <ListText source="nombre" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="encargado_contacto_id" label="Encargado" className="w-[125px]">
        <ReferenceField source="encargado_contacto_id" reference="crm/contactos">
          <ListText source="nombre_completo" className="whitespace-normal break-words" />
        </ReferenceField>
      </ListColumn>
      <BooleanListColumn source="activo" label="Activo" className="w-[70px]" />
      <ListColumn label="Acciones" className="w-[56px]">
        <NominaRowActions rowClick={rowClick} />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);

export default NominaList;
