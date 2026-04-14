"use client";

import { useDataProvider, useNotify, useRecordContext, useRefresh, useResourceContext } from "ra-core";
import { Copy, FileText } from "lucide-react";

import { apiUrl } from "@/lib/dataProvider";

import { List, LIST_CONTAINER_STANDARD } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  CompactSoloActivasToggleFilter,
  FormOrderListRowActions,
  BooleanListColumn,
  ListPaginator,
  TextListColumn,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
  useRowActionDialog,
} from "@/components/forms/form_order";

// ── Duplicar cláusula ─────────────────────────────────────────────────────────

const DuplicarMenuItem = () => {
  const record = useRecordContext();
  const resource = useResourceContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const dialog = useRowActionDialog();

  if (!record) return null;

  const handleConfirm = async () => {
    try {
      const { nombre, descripcion, activo, template } = record as any;
      await dataProvider.create(resource!, {
        data: {
          nombre: `${nombre} (copia)`,
          descripcion,
          activo,
          template,
        },
      });
      notify("Tipo de contrato duplicado", { type: "success" });
      refresh();
    } catch {
      notify("Error al duplicar", { type: "error" });
    }
  };

  return (
    <DropdownMenuItem
      className="gap-2 text-xs"
      onSelect={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dialog?.openDialog({
          title: "Duplicar tipo de contrato",
          content: `¿Duplicar "${(record as any).nombre}"? Se creará una copia con todos sus datos y cláusulas.`,
          confirmLabel: "Duplicar",
          onConfirm: handleConfirm,
        });
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
    >
      <Copy className="h-3.5 w-3.5" />
      Duplicar
    </DropdownMenuItem>
  );
};

// ── Vista previa PDF ─────────────────────────────────────────────────────────

const VisualizarPdfMenuItem = () => {
  const record = useRecordContext();
  if (!record) return null;

  return (
    <DropdownMenuItem
      className="gap-2 text-xs"
      onSelect={() => {
        window.open(`${apiUrl}/tipos-contrato/${record.id}/preview-pdf`, "_blank");
      }}
      data-row-click="ignore"
    >
      <FileText className="h-3.5 w-3.5" />
      Vista previa PDF
    </DropdownMenuItem>
  );
};

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar tipos de contrato",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "custom",
      element: (
        <CompactSoloActivasToggleFilter
          key="activo"
          source="activo"
          label="Activos"
          alwaysOn
          className="ml-auto"
        />
      ),
    },
  ],
  { keyPrefix: "tipos-contrato" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" to={createTo} />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

type TipoContratoListProps = {
  embedded?: boolean;
  perPage?: number;
  rowClick?: "edit" | ((id: string | number) => string);
  createTo?: string;
};

export const TipoContratoList = ({
  embedded = false,
  perPage = 10,
  rowClick = "edit",
  createTo,
}: TipoContratoListProps = {}) => (
  <List
    title="Tipos de contrato"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    debounce={300}
    perPage={perPage}
    filterDefaultValues={{ activo: true }}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
    containerClassName={LIST_CONTAINER_STANDARD}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: ["descripcion", "activo"],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="id" label="ID" className="w-[60px]">
        <ListText source="id" />
      </TextListColumn>
      <TextListColumn source="nombre" label="Nombre">
        <ListText source="nombre" />
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripcion" className="w-[280px]">
        <ListText source="descripcion" />
      </TextListColumn>
      <BooleanListColumn source="activo" label="Activo" />
      <TextListColumn label="Acciones" className="w-[60px]">
        <FormOrderListRowActions extraMenuItems={<><VisualizarPdfMenuItem /><DuplicarMenuItem /></>} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);
