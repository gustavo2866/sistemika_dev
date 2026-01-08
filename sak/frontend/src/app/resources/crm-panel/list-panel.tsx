"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { List } from "@/components/list";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ResourceTitle } from "@/components/resource-title";
import {
  Bookmark,
  Calendar,
  CheckCircle2,
  FileText,
  FolderOpen,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import { useListContext, useGetIdentity, useGetList } from "ra-core";
import type { CRMOportunidad } from "../crm-oportunidades/model";
import { CRM_OPORTUNIDAD_ESTADOS } from "../crm-oportunidades/model";
import { CRMOportunidadKanbanCard } from "./crm-panel-card";
import { KanbanBoardView } from "@/components/kanban";
import { calculateOportunidadBucketKey, prepareMoveOportunidadPayload, getBucketLabel } from "./model";
import { ESTADO_BG_COLORS, type BucketKey } from "../crm-oportunidades/model";
import { OportunidadCustomFilters } from "./crm-panel-customFilters";

// Definición de buckets (usando todos los estados)
const getBucketHeader = (estado: BucketKey, label: string) => {
  switch (estado) {
    case "0-prospect":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
          <Sparkles className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "1-abierta":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
          <FolderOpen className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "2-visita":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
          <Calendar className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "3-cotiza":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          <FileText className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "4-reserva":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
          <Bookmark className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "5-ganada":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "6-perdida":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
          <XCircle className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {label}
        </span>
      );
  }
};

const getBuckets = () => {
  return CRM_OPORTUNIDAD_ESTADOS.map((estado) => {
    const label = getBucketLabel(estado);
    return {
      key: estado as BucketKey,
      title: label,
      helper: "",
      accentClass: ESTADO_BG_COLORS[estado] ?? "from-white/95 to-slate-50/70",
      bucketClassName: "w-full min-w-[240px]",
      headerContent: getBucketHeader(estado as BucketKey, label),
    };
  });
};

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar oportunidades" alwaysOn />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="tipo_operacion_id"
    source="tipo_operacion_id"
    reference="crm/catalogos/tipos-operacion"
    label="Tipo de operación"
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="propiedad_id" source="propiedad_id" reference="propiedades" label="Propiedad">
    <SelectInput optionText="nombre" emptyText="Todas" />
  </ReferenceInput>,
  <ReferenceInput key="responsable_id" source="responsable_id" reference="users" label="Responsable">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton state={{ fromPanel: true }} />
    <ExportButton />
  </div>
);

const OportunidadListContent = () => {
  const { data: oportunidades = [], isLoading, filterValues, setFilters } =
    useListContext<CRMOportunidad>();
  const navigate = useNavigate();
  const appliedDefaultTipoRef = useRef(false);
  const { data: tiposOperacion } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const soloActivas = Boolean(filterValues.activo);
  const cutoffDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  }, []);
  const alquilerId = useMemo(() => {
    const alquiler = tiposOperacion?.find(
      (tipo: any) =>
        tipo?.codigo?.toLowerCase().includes("alquiler") ||
        tipo?.nombre?.toLowerCase().includes("alquiler")
    );
    return alquiler?.id ? String(alquiler.id) : undefined;
  }, [tiposOperacion]);

  useEffect(() => {
    if (appliedDefaultTipoRef.current) {
      return;
    }
    if (filterValues.tipo_operacion_id) {
      appliedDefaultTipoRef.current = true;
      return;
    }
    if (!alquilerId) {
      return;
    }
    setFilters({ ...filterValues, tipo_operacion_id: alquilerId }, {});
    appliedDefaultTipoRef.current = true;
  }, [alquilerId, filterValues, setFilters]);

  const shouldIncludeOportunidad = useCallback(
    (oportunidad: CRMOportunidad) => {
      if (soloActivas) {
        return oportunidad.activo !== false;
      }
      if (oportunidad.activo !== false) {
        return true;
      }
      if (!oportunidad.fecha_estado) {
        return false;
      }
      const parsed = new Date(oportunidad.fecha_estado);
      if (Number.isNaN(parsed.getTime())) {
        return false;
      }
      return parsed >= cutoffDate;
    },
    [soloActivas, cutoffDate]
  );

  const handleSoloActivasChange = useCallback(
    (next: boolean) => {
      const nextFilters = { ...filterValues };
      if (next) {
        nextFilters.activo = true;
      } else {
        delete nextFilters.activo;
      }
      setFilters(nextFilters, {});
    },
    [filterValues, setFilters]
  );


  // Renderizado de tarjeta
  const renderCard = useCallback(
    (oportunidad: CRMOportunidad, bucketKey?: BucketKey, collapsed?: boolean, onToggleCollapse?: () => void) => (
      <CRMOportunidadKanbanCard
        key={oportunidad.id}
        oportunidad={oportunidad}
        bucketKey={bucketKey}
        collapsed={collapsed}
        updating={false}
        onToggleCollapse={onToggleCollapse}
        onEdit={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}`, { state: { fromPanel: true, returnTo: "/crm/panel" } });
        }}
        onAceptar={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}/accion_aceptar`, { state: { returnTo: "/crm/panel" } });
        }}
        onAgendar={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}/accion_agendar`, { state: { returnTo: "/crm/panel" } });
        }}
        onCotizar={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}/accion_cotizar`, { state: { returnTo: "/crm/panel" } });
        }}
        onCerrar={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}/accion_cerrar`, { state: { returnTo: "/crm/panel" } });
        }}
        onDescartar={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}/accion_descartar`, { state: { returnTo: "/crm/panel" } });
        }}
      />
    ),
    [navigate]
  );

  // Definición de buckets
  const buckets = useMemo(() => getBuckets(), []);

  return (
    <>
      <div className="mx-auto w-full max-w-6xl">
        <KanbanBoardView<CRMOportunidad, BucketKey>
          items={oportunidades}
          buckets={buckets}
          getBucketKey={calculateOportunidadBucketKey}
          maxBucketsPerPage={4}
          bucketGridClassName="gap-3 md:gap-4 xl:gap-4"
          onItemMove={prepareMoveOportunidadPayload}
          resource="crm/oportunidades"
          getMoveSuccessMessage={(oportunidad, bucket) => `Oportunidad movida a ${getBucketLabel(bucket)}`}
          initialCollapsedAll={true}
          customFilter={(oportunidad) => shouldIncludeOportunidad(oportunidad)}
          filterConfig={{
            enableSearch: false,
            filterBarSpread: false,
            filterBarWrap: false,
            filterBarClassName: "w-fit px-2 py-1.5",
            collapseToggleAlignRight: false,
            enableCollapseToggle: true,
          }}
          customFilters={() => (
            <OportunidadCustomFilters
              soloActivas={soloActivas}
              onSoloActivasChange={handleSoloActivasChange}
            />
          )}
          renderCard={renderCard}
          isLoading={isLoading}
          loadingMessage="Cargando oportunidades..."
          emptyMessage="Sin oportunidades"
          noResultsMessage="No se encontraron oportunidades con los filtros aplicados"
        />
      </div>

    </>
  );
};

export const CRMOportunidadListKanban = () => {
  const { identity } = useGetIdentity();
  const defaultFilters = {
    panel_window_days: 30,
    activo: true,
    ...(identity?.id ? { responsable_id: identity.id } : {}),
  };

  return (
    <List
      resource="crm/oportunidades"
      title={<ResourceTitle icon={Target} text="CRM - Oportunidades (Kanban)" />}
      showBreadcrumb={false}
      filters={filters}
      actions={<ListActions />}
      perPage={500}
      pagination={false}
      filterDefaultValues={defaultFilters}
      sort={{ field: "fecha_estado", order: "DESC" }}
      className="space-y-5"
    >
      <OportunidadListContent />
    </List>
  );
};

// Alias para compatibilidad con rutas
export const CRMOportunidadPanelPage = CRMOportunidadListKanban;

export default CRMOportunidadListKanban;
