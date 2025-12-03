"use client";

import { useMemo, useState } from "react";
import { List } from "@/components/list";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useListContext,
  useDataProvider,
  useNotify,
  useRefresh,
  useCreatePath,
  ResourceContextProvider,
  useGetList,
} from "ra-core";
import { useNavigate } from "react-router";
import { ResourceTitle } from "@/components/resource-title";
import {
  CRM_OPORTUNIDAD_ESTADO_CHOICES,
  CRM_OPORTUNIDAD_ESTADOS,
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  formatEstadoOportunidad,
  type CRMOportunidad,
  type CRMOportunidadEstado,
} from "./model";
import { Target, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar oportunidades" className="w-full" alwaysOn />,
  <SelectInput key="estado" source="estado" label="Estado" choices={CRM_OPORTUNIDAD_ESTADO_CHOICES} emptyText="Todos" />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="tipo_operacion_id"
    source="tipo_operacion_id"
    reference="crm/catalogos/tipos-operacion"
    label="Tipo de operación"
    alwaysOn
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="propiedad_id" source="propiedad_id" reference="propiedades" label="Propiedad">
    <SelectInput optionText="nombre" emptyText="Todas" />
  </ReferenceInput>,
  <TextInput key="propiedad.tipo" source="propiedad.tipo" label="Tipo de propiedad" />,
  <ReferenceInput key="emprendimiento_id" source="emprendimiento_id" reference="emprendimientos" label="Emprendimiento">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
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

const ACTIVE_ESTADOS = ["0-prospect", "1-abierta", "2-visita", "3-cotiza", "4-reserva"];

const SoloActivasToggle = () => {
  const { filterValues, setFilters } = useListContext();
  const isSoloActivas = Boolean(filterValues.solo_activas);

  const handleToggle = (checked: boolean) => {
    const nextFilters = { ...filterValues };
    if (checked) {
      nextFilters.solo_activas = true;
      setEstadoFilterValue(nextFilters, [...ACTIVE_ESTADOS]);
    } else {
      delete nextFilters.solo_activas;
      setEstadoFilterValue(nextFilters, []);
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
    pagination: { page: 1, perPage: 50 },
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

  const buttons: Array<{ id: "todas" | "venta" | "alquiler"; label: string; disabled?: boolean }> = [
    { id: "todas", label: "Todas" },
    { id: "venta", label: "Venta", disabled: !ventaId },
    { id: "alquiler", label: "Alquiler", disabled: !alquilerId },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-1 py-1 shadow-sm">
      {buttons.map(({ id, label, disabled }) => {
        const active = currentMode === id;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => handleSelect(id)}
            className={cn(
              "min-w-[92px] rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all",
              active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-100",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            aria-pressed={active}
          >
            {label}
          </button>
        );
      })}
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

const KanbanBoard = ({ visibleEstados }: { visibleEstados: CRMOportunidadEstado[] }) => {
  const { data, isLoading } = useListContext<CRMOportunidad>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [hovered, setHovered] = useState<CRMOportunidadEstado | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<CRMOportunidadEstado, CRMOportunidad[]>();
    CRM_OPORTUNIDAD_ESTADOS.forEach((estado) => map.set(estado, []));
    (data ?? []).forEach((record) => {
      const column = map.get(record.estado);
      if (column) {
        column.push(record);
      }
    });
    return map;
  }, [data]);

  const handleDrop = async (
    estado: CRMOportunidadEstado,
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const transferId = Number(event.dataTransfer.getData("text/plain"));
    const oportunidadId = draggedId ?? transferId;
    setHovered(null);
    setDraggedId(null);
    if (!oportunidadId || !data) return;
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
    setHovered(estado);
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-3xl border border-dashed border-slate-200">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Cargando oportunidades...</span>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CRM_OPORTUNIDAD_ESTADO_CHOICES.filter((choice) =>
        visibleEstados.includes(choice.id as CRMOportunidadEstado),
      ).map((choice) => (
        <KanbanColumn
          key={choice.id}
          estado={choice.id as CRMOportunidadEstado}
          label={choice.name}
          cards={grouped.get(choice.id as CRMOportunidadEstado) ?? []}
          hovered={hovered}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragStart={handleDragStart}
        />
      ))}
    </div>
  );
};

const ESTADO_BG_COLORS: Record<CRMOportunidadEstado, string> = {
  "0-prospect": "from-slate-50/90 to-slate-100/80",
  "1-abierta": "from-blue-50/90 to-blue-100/70",
  "2-visita": "from-cyan-50/90 to-cyan-100/70",
  "3-cotiza": "from-amber-50/90 to-amber-100/70",
  "4-reserva": "from-violet-50/90 to-violet-100/70",
  "5-ganada": "from-emerald-50/90 to-emerald-100/70",
  "6-perdida": "from-rose-50/90 to-rose-100/70",
};

type KanbanColumnProps = {
  estado: CRMOportunidadEstado;
  label: string;
  cards: CRMOportunidad[];
  hovered: CRMOportunidadEstado | null;
  onDrop: (estado: CRMOportunidadEstado, event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>, estado: CRMOportunidadEstado) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, id: number) => void;
};

const KanbanColumn = ({ estado, label, cards, hovered, onDrop, onDragOver, onDragStart }: KanbanColumnProps) => {
  const bgClass = ESTADO_BG_COLORS[estado] ?? "from-white/95 to-slate-50/70";
  return (
    <div
    onDragOver={(event) => onDragOver(event, estado)}
    onDrop={(event) => onDrop(estado, event)}
    className={cn(
      "flex h-[40vh] flex-col gap-3 overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b p-4 shadow-lg transition hover:border-slate-300",
      bgClass,
      hovered === estado ? "ring-2 ring-primary/40" : "ring-0",
    )}
  >
    <div className="flex items-center justify-between rounded-2xl bg-slate-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
      <span>{label}</span>
      <Badge variant="outline" className="border-transparent bg-white text-xs text-slate-800 shadow-sm">
        {cards.length}
      </Badge>
    </div>
    <div className="flex-1 overflow-y-auto pr-1">
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-muted-foreground">
          Sin oportunidades
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          {cards.map((record) => (
            <KanbanCard key={record.id} record={record} onDragStart={onDragStart} />
          ))}
        </div>
      )}
    </div>
  </div>
  );
};

const KanbanCard = ({
  record,
  onDragStart,
}: {
  record: CRMOportunidad;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, id: number) => void;
}) => {
  const createPath = useCreatePath();
  const navigate = useNavigate();

  const handleOpen = () => {
    const to = createPath({
      resource: "crm/oportunidades",
      type: "edit",
      id: record.id,
    });
    navigate(to, { state: { fromPanel: true } });
  };

  const estadoClass = CRM_OPORTUNIDAD_ESTADO_BADGES[record.estado] ?? "bg-slate-100 text-slate-800";

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => onDragStart(event, record.id)}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          handleOpen();
        }
      }}
      className="cursor-grab rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-400 hover:shadow-md focus:outline-none"
    >
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>#{record.id}</span>
        <Badge variant="outline" className={cn("border-transparent text-[10px] font-semibold", estadoClass)}>
          {formatEstadoOportunidad(record.estado)}
        </Badge>
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground line-clamp-2">
        {record.descripcion_estado || "Sin descripción"}
      </p>
      <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
        <p>Contacto #{record.contacto_id}</p>
        <p>Responsable #{record.responsable_id}</p>
      </div>
    </div>
  );
};

const StageNavigator = ({
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) => (
  <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-2 py-1 shadow-sm">
    <Button
      type="button"
      variant={canPrev ? "outline" : "ghost"}
      size="sm"
      className={cn(
        "h-8 rounded-full px-4 text-xs font-semibold uppercase tracking-wide",
        canPrev ? "text-slate-900" : "text-muted-foreground",
      )}
      onClick={onPrev}
      disabled={!canPrev}
    >
      Anterior
    </Button>
    <Button
      type="button"
      variant={canNext ? "outline" : "ghost"}
      size="sm"
      className={cn(
        "h-8 rounded-full px-4 text-xs font-semibold uppercase tracking-wide",
        canNext ? "text-slate-900" : "text-muted-foreground",
      )}
      onClick={onNext}
      disabled={!canNext}
    >
      Siguiente
    </Button>
  </div>
);

const KanbanFilters = ({
  stageWindow,
  onPrevStage,
  onNextStage,
  canPrevStage,
  canNextStage,
}: {
  stageWindow: StageWindow;
  onPrevStage: () => void;
  onNextStage: () => void;
  canPrevStage: boolean;
  canNextStage: boolean;
}) => (
  <div className="flex flex-wrap items-center gap-3">
    <OperacionToggle />
    <div className="flex flex-wrap items-center gap-2">
      <SoloActivasToggle />
      <StageNavigator
        windowLabel={stageWindow.label}
        onPrev={onPrevStage}
        onNext={onNextStage}
        canPrev={canPrevStage}
        canNext={canNextStage}
      />
    </div>
  </div>
);

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
      title={<ResourceTitle icon={Target} text="CRM - Panel" />}
      filters={filters}
      actions={<ListActions />}
      perPage={100}
      sort={{ field: "fecha_estado", order: "DESC" }}
      className="space-y-6"
    >
      <div className="space-y-5 rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/90 p-5 shadow-[0_30px_60px_rgba(15,23,42,0.12)]">
        <KanbanFilters
          stageWindow={stageWindow}
          onPrevStage={handlePrevStage}
          onNextStage={handleNextStage}
          canPrevStage={stageWindowIndex > 0}
          canNextStage={stageWindowIndex < PANEL_STAGE_WINDOWS.length - 1}
        />
        <KanbanBoard visibleEstados={visibleEstados} />
      </div>
    </List>
  );
};

export const CRMOportunidadPanelPage = () => (
  <ResourceContextProvider value="crm/oportunidades">
    <CRMOportunidadPanelInner />
  </ResourceContextProvider>
);
