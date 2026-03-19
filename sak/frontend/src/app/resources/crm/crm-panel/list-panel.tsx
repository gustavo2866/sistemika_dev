"use client";

import { useMemo } from "react";
import { List } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { KanbanBoardView } from "@/components/forms/form_order";
import { ResourceTitle } from "@/components/resource-title";
import {
  Bookmark,
  CheckCircle2,
  FolderOpen,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import type { CRMOportunidad } from "../crm-oportunidades/model";
import {
  CompactSoloActivasToggleFilter,
  buildListFilters,
} from "@/components/forms/form_order";
import {
  getPanelBucketLabel,
  PANEL_BUCKET_CONFIG,
  PANEL_BUCKET_ORDER,
  type PanelBucketKey,
} from "./model";
import { useListPanel } from "./use-list-panel";

const getBucketHeader = (bucketKey: PanelBucketKey, label: string) => {
  switch (bucketKey) {
    case "prospect":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-sky-700">
          <Sparkles className="h-2.5 w-2.5" />
          {label}
        </span>
      );
    case "en-proceso":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-blue-700">
          <FolderOpen className="h-2.5 w-2.5" />
          {label}
        </span>
      );
    case "reservadas":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-violet-700">
          <Bookmark className="h-2.5 w-2.5" />
          {label}
        </span>
      );
    case "cerradas":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-slate-700">
          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
          <XCircle className="h-2.5 w-2.5 text-rose-600" />
          {label}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-slate-600">
          {label}
        </span>
      );
  }
};

const getBuckets = () =>
  PANEL_BUCKET_ORDER.map((bucketKey) => {
    const label = getPanelBucketLabel(bucketKey);
    return {
      key: bucketKey,
      title: label,
      helper: "",
      accentClass:
        PANEL_BUCKET_CONFIG[bucketKey].accentClass ??
        "from-white/95 to-slate-50/70",
      bucketClassName: "w-full min-w-[160px]",
      headerContent: getBucketHeader(bucketKey, label),
      interactive: PANEL_BUCKET_CONFIG[bucketKey].interactive,
    };
  });

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar oportunidades",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
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
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "tipo_operacion_id",
        reference: "crm/catalogos/tipos-operacion",
        label: "Tipo de operacion",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "propiedad_id",
        reference: "propiedades",
        label: "Propiedad",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todas",
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
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "crm-panel" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={actionButtonClass}
    />
    <CreateButton
      className={actionButtonClass}
      label="Crear"
      state={{ fromPanel: true }}
    />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

const OportunidadListContent = () => {
  const { bucketData, loadMore, handleItemMove, renderCard } = useListPanel();
  const buckets = useMemo(() => getBuckets(), []);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <KanbanBoardView<CRMOportunidad, PanelBucketKey>
        mode="remote"
        bucketData={bucketData}
        buckets={buckets}
        showBucketPaginationFooter={false}
        bucketGridClassName="gap-3 md:gap-4 xl:gap-4"
        onItemMove={handleItemMove}
        onLoadMore={loadMore}
        resource="crm/oportunidades"
        getMoveSuccessMessage={(oportunidad, bucket) =>
          `Oportunidad movida a ${getPanelBucketLabel(bucket)}`
        }
        initialCollapsedAll={true}
        filterConfig={{
          enableSearch: false,
          filterBarSpread: false,
          filterBarWrap: false,
          filterBarClassName: "w-fit px-2 py-1.5",
          collapseToggleAlignRight: false,
          enableCollapseToggle: false,
        }}
        renderCard={renderCard}
        emptyMessage="Sin oportunidades"
        noResultsMessage="No se encontraron oportunidades con los filtros aplicados"
      />
    </div>
  );
};

export const CRMOportunidadListKanban = () => {
  return (
    <List
      resource="crm/oportunidades"
      title={<ResourceTitle icon={Target} text="CRM - Oportunidades (Kanban)" />}
      showBreadcrumb={false}
      filters={LIST_FILTERS}
      actions={<ListActions />}
      perPage={1}
      pagination={false}
      sort={{ field: "fecha_estado", order: "DESC" }}
      className="space-y-5"
      filterDebounce={0}
      storeKey="crm-panel.listParams"
    >
      <OportunidadListContent />
    </List>
  );
};

export const CRMOportunidadPanelPage = CRMOportunidadListKanban;

export default CRMOportunidadListKanban;
