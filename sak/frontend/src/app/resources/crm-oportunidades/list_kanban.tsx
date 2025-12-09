"use client";

import { useCallback, useMemo } from "react";
import { List } from "@/components/list";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ResourceTitle } from "@/components/resource-title";
import { Target } from "lucide-react";
import { useListContext } from "ra-core";
import type { CRMOportunidad } from "./model";
import { CRM_OPORTUNIDAD_ESTADOS } from "./model";
import { CRMOportunidadKanbanCard } from "./oportunidad-kanban-card";
import { KanbanBoardView } from "@/components/kanban";
import { calculateOportunidadBucketKey, prepareMoveOportunidadPayload, getBucketLabel } from "./kanban-model";
import { ESTADO_BG_COLORS, getResponsableName, getContactoName, type BucketKey } from "./oportunidad-helpers";
import { OportunidadCustomFilters } from "./custom-filters";

// Definición de buckets (usando todos los estados)
const getBuckets = () => {
  return CRM_OPORTUNIDAD_ESTADOS.map((estado) => ({
    key: estado as BucketKey,
    title: getBucketLabel(estado),
    helper: "",
    accentClass: ESTADO_BG_COLORS[estado] ?? "from-white/95 to-slate-50/70",
  }));
};

// Filtro de búsqueda
const searchFilterFn = (oportunidad: CRMOportunidad, searchTerm: string) => {
  const titulo = oportunidad.titulo ?? "";
  const contacto = getContactoName(oportunidad);
  const responsable = getResponsableName(oportunidad);
  const id = String(oportunidad.id);
  
  return (
    titulo.toLowerCase().includes(searchTerm) ||
    contacto.toLowerCase().includes(searchTerm) ||
    responsable.toLowerCase().includes(searchTerm) ||
    id.includes(searchTerm)
  );
};

// Filtro de responsable
const ownerFilterFn = (oportunidad: CRMOportunidad, ownerId: string) => {
  const oportunidadOwnerId = (oportunidad as any).responsable?.id ?? oportunidad.responsable_id;
  return String(oportunidadOwnerId ?? "") === ownerId;
};

const filters = [
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
    <CreateButton />
    <ExportButton />
  </div>
);

const OportunidadListContent = () => {
  const { data: oportunidades = [], isLoading } = useListContext<CRMOportunidad>();

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
          console.log("Edit oportunidad", opp.id);
          // TODO: Implementar diálogo de edición
        }}
        onAgendar={(opp) => {
          console.log("Agendar visita para oportunidad", opp.id);
          // TODO: Implementar diálogo de agendar
        }}
        onCotizar={(opp) => {
          console.log("Cotizar oportunidad", opp.id);
          // TODO: Implementar diálogo de cotizar
        }}
        onCerrar={(opp) => {
          console.log("Cerrar oportunidad", opp.id);
          // TODO: Implementar diálogo de cerrar
        }}
        onDescartar={(opp) => {
          console.log("Descartar oportunidad", opp.id);
          // TODO: Implementar diálogo de descartar
        }}
      />
    ),
    []
  );

  // Definición de buckets
  const buckets = useMemo(() => getBuckets(), []);

  return (
    <KanbanBoardView<CRMOportunidad, BucketKey>
      items={oportunidades}
      buckets={buckets}
      getBucketKey={calculateOportunidadBucketKey}
      onItemMove={prepareMoveOportunidadPayload}
      resource="crm/oportunidades"
      getMoveSuccessMessage={(oportunidad, bucket) => `Oportunidad movida a ${getBucketLabel(bucket)}`}
      searchFilter={searchFilterFn}
      ownerFilter={ownerFilterFn}
      filterConfig={{
        enableSearch: true,
        searchPlaceholder: "Buscar oportunidades...",
        enableOwnerFilter: true,
        ownerFilterPlaceholder: "Responsable",
        enableCollapseToggle: true,
      }}
      customFilters={() => <OportunidadCustomFilters />}
      renderCard={renderCard}
      isLoading={isLoading}
      loadingMessage="Cargando oportunidades..."
      emptyMessage="Sin oportunidades"
      noResultsMessage="No se encontraron oportunidades con los filtros aplicados"
    />
  );
};

export const CRMOportunidadListKanban = () => {
  return (
    <List
      resource="crm/oportunidades"
      title={<ResourceTitle icon={Target} text="CRM - Oportunidades (Kanban)" />}
      showBreadcrumb={false}
      filters={filters}
      actions={<ListActions />}
      perPage={500}
      pagination={false}
      sort={{ field: "fecha_estado", order: "DESC" }}
      className="space-y-5"
    >
      <OportunidadListContent />
    </List>
  );
};

export default CRMOportunidadListKanban;
