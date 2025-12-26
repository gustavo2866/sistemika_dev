"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { List } from "@/components/list";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { cn } from "@/lib/utils";
import { useListContext, useDataProvider, useNotify, useRefresh, useGetList } from "ra-core";
import { ResourceTitle } from "@/components/resource-title";
import {
  CRM_OPORTUNIDAD_ESTADO_CHOICES,
  CRM_OPORTUNIDAD_ESTADOS,
  formatEstadoOportunidad,
  type CRMOportunidad,
  type CRMOportunidadEstado,
} from "./model";
import { Target } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UserSelect, type UserSelectOption } from "@/components/forms";
import { KanbanBoard, KanbanCollapseToggle, KanbanFilterBar, useKanbanCommonState } from "@/components/kanban";
import { CRMOportunidadKanbanCard } from "@/components/kanban/crm-oportunidad-card";

const filters = [
  <div key="q-hidden" className="hidden">
    <TextInput source="q" label={false} placeholder="Buscar oportunidades" alwaysOn />
  </div>,
  <div key="estado-hidden" className="hidden">
    <SelectInput source="estado" label="Estado" choices={CRM_OPORTUNIDAD_ESTADO_CHOICES} emptyText="Todos" />
  </div>,
  <div key="contacto-hidden" className="hidden">
    <ReferenceInput source="contacto_id" reference="crm/contactos" label="Contacto">
      <SelectInput optionText="nombre_completo" emptyText="Todos" />
    </ReferenceInput>
  </div>,
  <div key="tipo-operacion-hidden" className="hidden">
    <ReferenceInput
      source="tipo_operacion_id"
      reference="crm/catalogos/tipos-operacion"
      label="Tipo de operación"
      alwaysOn
    >
      <SelectInput optionText="nombre" emptyText="Todos" />
    </ReferenceInput>
  </div>,
  <div key="propiedad-hidden" className="hidden">
    <ReferenceInput source="propiedad_id" reference="propiedades" label="Propiedad">
      <SelectInput optionText="nombre" emptyText="Todas" />
    </ReferenceInput>
  </div>,
  <div key="propiedad-tipo-hidden" className="hidden">
    <TextInput source="propiedad.tipo" label="Tipo de propiedad" />
  </div>,
  <div key="emprendimiento-hidden" className="hidden">
    <ReferenceInput source="emprendimiento_id" reference="emprendimientos" label="Emprendimiento">
      <SelectInput optionText="nombre" emptyText="Todos" />
    </ReferenceInput>
  </div>,
];

const ListActions = () => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

const normalizeEstadoFilter = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : String(v ?? "")))
      .filter((v) => v.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
};

const setEstadoFilterValue = (filtersObj: Record<string, unknown>, values: string[]) => {
  if (values.length) {
    filtersObj.estado = values;
  } else {
    delete filtersObj.estado;
  }
};

const estadosEqual = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);

const SoloActivasToggle = () => {
  const { filterValues, setFilters } = useListContext();
  const isSoloActivas = Boolean(filterValues.activo);

  const handleToggle = (checked: boolean) => {
    const nextFilters = { ...filterValues };
    if (checked) {
      nextFilters.activo = true;
    } else {
      delete nextFilters.activo;
    }
    setFilters(nextFilters, {});
  };

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
      <Switch id="solo-activas-panel" checked={isSoloActivas} onCheckedChange={handleToggle} />
      <Label htmlFor="solo-activas-panel" className="text-sm font-medium">
        Solo activas
      </Label>
    </div>
  );
};

const OperacionToggle = () => {
  const { filterValues, setFilters } = useListContext();
  const { data: tipos } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const { ventaId, alquilerId } = useMemo(() => {
    const findMatch = (term: string) =>
      tipos?.find(
        (tipo: any) =>
          tipo?.codigo?.toLowerCase().includes(term) || tipo?.nombre?.toLowerCase().includes(term),
      );
    const venta = findMatch("venta");
    const alquiler = findMatch("alquiler");
    return {
      ventaId: venta?.id ? String(venta.id) : undefined,
      alquilerId: alquiler?.id ? String(alquiler.id) : undefined,
    };
  }, [tipos]);

  const currentId = filterValues.tipo_operacion_id ? String(filterValues.tipo_operacion_id) : undefined;
  const currentMode = currentId === ventaId ? "venta" : currentId === alquilerId ? "alquiler" : "todas";

  const handleSelect = (mode: "todas" | "venta" | "alquiler") => {
    const nextFilters = { ...filterValues };
    if (mode === "venta" && ventaId) {
      nextFilters.tipo_operacion_id = ventaId;
    } else if (mode === "alquiler" && alquilerId) {
      nextFilters.tipo_operacion_id = alquilerId;
    } else {
      delete nextFilters.tipo_operacion_id;
    }
    setFilters(nextFilters, {});
  };

  const renderToggle = (
    mode: "venta" | "alquiler",
    label: string,
    disabled?: boolean,
    extraClass?: string,
  ) => {
    const active = currentMode === mode;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleSelect(active ? "todas" : mode)}
        className={cn(
          "min-w-[70px] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all",
          active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-100",
          disabled && "opacity-40 cursor-not-allowed",
          extraClass,
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center rounded-full border border-slate-200/80 bg-white/80 shadow-sm overflow-hidden">
      {renderToggle("venta", "Venta", !ventaId, "rounded-l-full")}
      {renderToggle("alquiler", "Alquiler", !alquilerId, "rounded-r-full")}
    </div>
  );
};

const PANEL_STAGE_WINDOWS = [
  {
    id: "inicio",
    label: "Prospect a Cotiza",
    startIndex: 0,
    endIndex: 3,
  },
  {
    id: "cierre",
    label: "Cotiza a Perdida",
    startIndex: 3,
    endIndex: CRM_OPORTUNIDAD_ESTADOS.length - 1,
  },
] as const;

type StageWindow = (typeof PANEL_STAGE_WINDOWS)[number];

const INITIAL_STAGE_ESTADOS = CRM_OPORTUNIDAD_ESTADOS.slice(
  PANEL_STAGE_WINDOWS[0].startIndex,
  PANEL_STAGE_WINDOWS[0].endIndex + 1,
) as CRMOportunidadEstado[];

const ESTADO_BG_COLORS: Record<CRMOportunidadEstado, string> = {
  "0-prospect": "from-slate-50/90 to-slate-100/80",
  "1-abierta": "from-blue-50/90 to-blue-100/70",
  "2-visita": "from-cyan-50/90 to-cyan-100/70",
  "3-cotiza": "from-amber-50/90 to-amber-100/70",
  "4-reserva": "from-violet-50/90 to-violet-100/70",
  "5-ganada": "from-emerald-50/90 to-emerald-100/70",
  "6-perdida": "from-rose-50/90 to-rose-100/70",
};

const CRMOportunidadKanbanSection = ({
  visibleEstados,
  stageWindow,
  onPrevStage,
  onNextStage,
  canPrevStage,
  canNextStage,
}: {
  visibleEstados: CRMOportunidadEstado[];
  stageWindow: StageWindow;
  onPrevStage: () => void;
  onNextStage: () => void;
  canPrevStage: boolean;
  canNextStage: boolean;
}) => {
  const { data = [], isLoading } = useListContext<CRMOportunidad>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [hoveredEstado, setHoveredEstado] = useState<CRMOportunidadEstado | null>(null);
  const {
    searchValue,
    setSearchValue,
    ownerFilter,
    setOwnerFilter,
    collapsedAll,
    toggleCollapsedAll,
    isCardCollapsed,
    toggleCardCollapse,
  } = useKanbanCommonState();

  const ownerOptions = useMemo<UserSelectOption[]>(() => {
    const entries = new Map<string, UserSelectOption>();
    data.forEach((record) => {
      const responsable: any = (record as any).responsable;
      const responsableId = responsable?.id ?? record.responsable_id;
      if (!responsableId) {
        return;
      }
      const key = String(responsableId);
      if (entries.has(key)) {
        return;
      }
      const label =
        responsable?.nombre ??
        responsable?.nombre_completo ??
        responsable?.full_name ??
        `Usuario #${responsableId}`;
      const avatar = responsable?.avatar ?? responsable?.url_foto ?? null;
      entries.set(key, { value: key, label, avatar });
    });
    return [{ value: "todos", label: "Todos", avatar: null }, ...Array.from(entries.values())];
  }, [data]);

  const filteredData = useMemo(
    () =>
      (data ?? []).filter((record) => {
        if (ownerFilter !== "todos") {
          const responsable: any = (record as any).responsable;
          const responsableId = responsable?.id ?? record.responsable_id;
          if (!responsableId || String(responsableId) !== ownerFilter) {
            return false;
          }
        }
        const term = searchValue.trim().toLowerCase();
        if (!term) {
          return true;
        }
        const contactName = ((record as any).contacto?.nombre_completo ?? "").toLowerCase();
        const title = (record.titulo ?? "").toLowerCase();
        return title.includes(term) || contactName.includes(term) || String(record.id).includes(term);
      }),
    [data, ownerFilter, searchValue],
  );

  const bucketItems = useMemo(() => {
    const grouped: Record<CRMOportunidadEstado, CRMOportunidad[]> = {} as Record<
      CRMOportunidadEstado,
      CRMOportunidad[]
    >;
    CRM_OPORTUNIDAD_ESTADOS.forEach((estado) => {
      grouped[estado] = [];
    });
    filteredData.forEach((record) => {
      if (grouped[record.estado]) {
        grouped[record.estado].push(record);
      }
    });
    return grouped;
  }, [filteredData]);

  const bucketDefinitions = useMemo(
    () =>
      visibleEstados.map((estado) => ({
        key: estado,
        title: formatEstadoOportunidad(estado),
        helper: "",
        accentClass: ESTADO_BG_COLORS[estado] ?? "from-white/95 to-slate-50/70",
      })),
    [visibleEstados],
  );

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, estado: CRMOportunidadEstado) => {
    event.preventDefault();
    const transferId = Number(event.dataTransfer.getData("text/plain"));
    const oportunidadId = draggedId ?? transferId;
    setHoveredEstado(null);
    setDraggedId(null);
    if (!oportunidadId) return;
    const record = data.find((item) => item.id === oportunidadId);
    if (!record || record.estado === estado) return;
    try {
      await dataProvider.update("crm/oportunidades", {
        id: oportunidadId,
        data: { ...record, estado },
        previousData: record,
      });
      notify("Estado actualizado", { type: "info" });
      refresh();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo cambiar el estado", { type: "warning" });
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, id: number) => {
    setDraggedId(id);
    event.dataTransfer.setData("text/plain", String(id));
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, estado: CRMOportunidadEstado) => {
    event.preventDefault();
    setHoveredEstado(estado);
  };

  const handleDragLeave = () => setHoveredEstado(null);

  const handleCardToggle = useCallback(
    (record: CRMOportunidad) => {
      toggleCardCollapse(record.id);
    },
    [toggleCardCollapse],
  );

  const renderCardContent = (record: CRMOportunidad) => (
    <CRMOportunidadKanbanCard
      key={record.id}
      record={record}
      onDragStart={handleDragStart}
      collapsed={isCardCollapsed(record.id)}
      onToggleCollapse={handleCardToggle}
    />
  );

  const noResults = filteredData.length === 0;

  const filterBar = (
    <KanbanFilters
      stageWindow={stageWindow}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      ownerFilter={ownerFilter}
      onOwnerFilterChange={setOwnerFilter}
      ownerOptions={ownerOptions}
      collapsedAll={collapsedAll}
      onToggleCollapsed={toggleCollapsedAll}
    />
  );

  return (
    <KanbanBoard<CRMOportunidad, CRMOportunidadEstado>
      filterBar={filterBar}
      isLoading={isLoading}
      loadingMessage="Cargando oportunidades..."
      bucketDefinitions={bucketDefinitions}
      bucketItems={bucketItems}
      renderCard={(record) => renderCardContent(record)}
      dragOverBucket={hoveredEstado}
      emptyMessage="Sin oportunidades"
      onBucketDragOver={(event, estado) => handleDragOver(event, estado)}
      onBucketDrop={(event, estado) => handleDrop(event, estado)}
      onBucketDragLeave={handleDragLeave}
      noResults={noResults}
      noResultsMessage="No se encontraron oportunidades en estas etapas"
      bucketNavigation={{
        canPrev: canPrevStage,
        canNext: canNextStage,
        onPrev: onPrevStage,
        onNext: onNextStage,
      }}
    />
  );
};

const KanbanFilters = ({
  stageWindow,
  searchValue,
  onSearchChange,
  ownerFilter,
  onOwnerFilterChange,
  ownerOptions,
  collapsedAll,
  onToggleCollapsed,
}: {
  stageWindow: StageWindow;
  searchValue: string;
  onSearchChange: (value: string) => void;
  ownerFilter: string;
  onOwnerFilterChange: (value: string) => void;
  ownerOptions: UserSelectOption[];
  collapsedAll: boolean;
  onToggleCollapsed: () => void;
}) => {
  const { filterValues, setFilters } = useListContext();
  const stageEstados = useMemo(
    () =>
      CRM_OPORTUNIDAD_ESTADOS.slice(stageWindow.startIndex, stageWindow.endIndex + 1) as CRMOportunidadEstado[],
    [stageWindow.startIndex, stageWindow.endIndex],
  );

  useEffect(() => {
    const currentEstados = normalizeEstadoFilter(filterValues.estado);
    if (estadosEqual(currentEstados, stageEstados)) {
      return;
    }
    const nextFilters = { ...filterValues };
    setEstadoFilterValue(nextFilters, [...stageEstados]);
    setFilters(nextFilters, {});
  }, [stageEstados, filterValues, setFilters]);

  return (
    <div className="space-y-3">
      <KanbanFilterBar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder="Buscar oportunidades..."
        searchClassName="w-[110px]"
        rightContent={
          <>
            <div className="flex items-center gap-2">
              <div className="min-w-[180px]">
                <UserSelect
                  value={ownerFilter}
                  onValueChange={onOwnerFilterChange}
                  options={ownerOptions}
                  placeholder="Responsable"
                />
              </div>
              <OperacionToggle />
              <SoloActivasToggle />
            </div>
            <KanbanCollapseToggle collapsed={collapsedAll} onToggle={onToggleCollapsed} />
          </>
        }
      />
    </div>
  );
};

const CRMOportunidadPanelInner = () => {
  const [stageWindowIndex, setStageWindowIndex] = useState(0);
  const stageWindow = PANEL_STAGE_WINDOWS[stageWindowIndex];
  const start = Math.max(0, stageWindow.startIndex);
  const end = Math.min(CRM_OPORTUNIDAD_ESTADOS.length - 1, stageWindow.endIndex);
  const visibleEstados = CRM_OPORTUNIDAD_ESTADOS.slice(start, end + 1) as CRMOportunidadEstado[];

  const handlePrevStage = () => {
    setStageWindowIndex((prev) => Math.max(0, prev - 1));
  };
  const handleNextStage = () => {
    setStageWindowIndex((prev) => Math.min(PANEL_STAGE_WINDOWS.length - 1, prev + 1));
  };

  return (
    <List
      resource="crm/oportunidades"
      title={<ResourceTitle icon={Target} text="CRM - Panel" />}
      filters={filters}
      filterDefaultValues={{ estado: INITIAL_STAGE_ESTADOS }}
      actions={<ListActions />}
      perPage={500}
      pagination={false}
      sort={{ field: "fecha_estado", order: "DESC" }}
      showBreadcrumb={false}
      className="space-y-6"
    >
      <div className="space-y-5">
        <CRMOportunidadKanbanSection
          visibleEstados={visibleEstados}
          stageWindow={stageWindow}
          onPrevStage={handlePrevStage}
          onNextStage={handleNextStage}
          canPrevStage={stageWindowIndex > 0}
          canNextStage={stageWindowIndex < PANEL_STAGE_WINDOWS.length - 1}
        />
      </div>
    </List>
  );
};

export const CRMOportunidadPanelPage = () => <CRMOportunidadPanelInner />;
