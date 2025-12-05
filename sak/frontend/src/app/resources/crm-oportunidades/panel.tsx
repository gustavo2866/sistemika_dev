"use client";

import { useMemo, useState, useEffect } from "react";
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
  useGetIdentity,
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
import { Target, Loader2, ChevronLeft, ChevronRight, X, Check, ArrowRightCircle, CalendarPlus, Archive } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EVENT_TYPE_CHOICES, DEFAULT_EVENT_STATE, getDefaultDateTime } from "../crm-mensajes/model";

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

const INITIAL_STAGE_ESTADOS = CRM_OPORTUNIDAD_ESTADOS.slice(
  PANEL_STAGE_WINDOWS[0].startIndex,
  PANEL_STAGE_WINDOWS[0].endIndex + 1,
) as CRMOportunidadEstado[];

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
      "flex h-[65vh] flex-col gap-3 overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b p-4 shadow-lg transition hover:border-slate-300",
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

const CompletarOportunidadDialog = ({
  open,
  onOpenChange,
  record,
  onComplete,
  isProcessing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CRMOportunidad;
  onComplete: (data: any) => void;
  isProcessing: boolean;
}) => {
  const [formData, setFormData] = useState({
    titulo: record.titulo || "",
    tipo_operacion_id: record.tipo_operacion_id || null,
    tipo_propiedad_id: record.tipo_propiedad_id || null,
    emprendimiento_id: record.emprendimiento_id || null,
    descripcion_estado: record.descripcion_estado || "",
  });

  // Cargar datos de los catálogos
  const { data: tiposOperacion } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const { data: tiposPropiedad } = useGetList("tipos-propiedad", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const { data: emprendimientos } = useGetList("emprendimientos", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Completar Oportunidad</DialogTitle>
          <DialogDescription>
            Completa los datos generales para mover la oportunidad a estado Abierta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="titulo">Título *</Label>
              <input
                id="titulo"
                type="text"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tipo_operacion">Tipo de operación *</Label>
                <select
                  id="tipo_operacion"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.tipo_operacion_id || ""}
                  onChange={(e) => setFormData({ ...formData, tipo_operacion_id: e.target.value ? Number(e.target.value) : null })}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {tiposOperacion?.map((tipo: any) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="tipo_propiedad">Tipo de propiedad</Label>
                <select
                  id="tipo_propiedad"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.tipo_propiedad_id || ""}
                  onChange={(e) => setFormData({ ...formData, tipo_propiedad_id: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Seleccionar...</option>
                  {tiposPropiedad?.map((tipo: any) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="emprendimiento">Emprendimiento</Label>
              <select
                id="emprendimiento"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.emprendimiento_id || ""}
                onChange={(e) => setFormData({ ...formData, emprendimiento_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Seleccionar...</option>
                {emprendimientos?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="descripcion">Descripción</Label>
              <textarea
                id="descripcion"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={formData.descripcion_estado}
                onChange={(e) => setFormData({ ...formData, descripcion_estado: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Completar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();
  
  const [showDescartarDialog, setShowDescartarDialog] = useState(false);
  const [showCompletarDialog, setShowCompletarDialog] = useState(false);
  const [showCerrarDialog, setShowCerrarDialog] = useState(false);
  const [showVisitaDialog, setShowVisitaDialog] = useState(false);
  const [showCotizarDialog, setShowCotizarDialog] = useState(false);
  const [showArchivarDialog, setShowArchivarDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [perderMotivoId, setPerderMotivoId] = useState("");
  const [perderNota, setPerderNota] = useState("");

  const visitaDefaultType =
    EVENT_TYPE_CHOICES.find((choice) => choice.value === "visita")?.value ?? EVENT_TYPE_CHOICES[0].value;
  const [visitaForm, setVisitaForm] = useState({
    titulo: "",
    descripcion: "",
    tipoEvento: visitaDefaultType,
    datetime: getDefaultDateTime(),
    asignadoId: "",
  });
  const [cotizarForm, setCotizarForm] = useState({
    propiedadId: "",
    tipoPropiedadId: "",
    monto: "",
    monedaId: "",
    condicionPagoId: "",
    formaPagoDescripcion: "",
  });

  const { data: motivosPerdida } = useGetList("crm/catalogos/motivos-perdida", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const { data: responsablesData } = useGetList("users", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: propiedadesData } = useGetList("propiedades", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: tiposPropiedadData } = useGetList("tipos-propiedad", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: monedasData } = useGetList("monedas", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: condicionesPagoData } = useGetList("crm/catalogos/condiciones-pago", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const responsables = useMemo(
    () =>
      (responsablesData ?? []).map((user: any) => ({
        value: String(user.id),
        label: user.nombre_completo || user.nombre || user.email || `Usuario #${user.id}`,
      })),
    [responsablesData]
  );
  const propiedades = useMemo(
    () =>
      (propiedadesData ?? []).map((item: any) => ({
        value: String(item.id),
        label: item.nombre ?? `Propiedad #${item.id}`,
      })),
    [propiedadesData]
  );
  const tiposPropiedad = useMemo(
    () =>
      (tiposPropiedadData ?? []).map((item: any) => ({
        value: String(item.id),
        label: item.nombre ?? `Tipo #${item.id}`,
      })),
    [tiposPropiedadData]
  );
  const monedas = useMemo(
    () =>
      (monedasData ?? []).map((item: any) => ({
        value: String(item.id),
        label: item.simbolo ?? item.codigo ?? item.nombre ?? `Moneda #${item.id}`,
      })),
    [monedasData]
  );
  const condicionesPago = useMemo(
    () =>
      (condicionesPagoData ?? []).map((item: any) => ({
        value: String(item.id),
        label: item.nombre ?? `Condición #${item.id}`,
      })),
    [condicionesPagoData]
  );

  useEffect(() => {
    if (showVisitaDialog) {
      setVisitaForm({
        titulo: record.titulo ? `Visita - ${record.titulo}` : "Visita programada",
        descripcion: "",
        tipoEvento: visitaDefaultType,
        datetime: getDefaultDateTime(),
        asignadoId: identity?.id != null ? String(identity.id) : responsables[0]?.value ?? "",
      });
    }
  }, [showVisitaDialog, record.titulo, visitaDefaultType, identity?.id, responsables]);

  useEffect(() => {
    if (showCotizarDialog) {
      setCotizarForm({
        propiedadId: record.propiedad_id ? String(record.propiedad_id) : "",
        tipoPropiedadId: record.tipo_propiedad_id ? String(record.tipo_propiedad_id) : "",
        monto: record.monto ? String(record.monto) : "",
        monedaId: record.moneda_id ? String(record.moneda_id) : "",
        condicionPagoId: record.condicion_pago_id ? String(record.condicion_pago_id) : "",
        formaPagoDescripcion: record.forma_pago_descripcion ?? "",
      });
    }
  }, [
    showCotizarDialog,
    record.propiedad_id,
    record.tipo_propiedad_id,
    record.monto,
    record.moneda_id,
    record.condicion_pago_id,
    record.forma_pago_descripcion,
  ]);

  const handleOpen = () => {
    const to = createPath({
      resource: "crm/oportunidades",
      type: "edit",
      id: record.id,
    });
    navigate(to, { state: { fromPanel: true } });
  };

  const estadoClass = CRM_OPORTUNIDAD_ESTADO_BADGES[record.estado] ?? "bg-slate-100 text-slate-800";

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    handleOpen();
  };

  const handleDescartar = async () => {
    setIsProcessing(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { activo: false },
        previousData: record,
      });
      notify("Oportunidad descartada", { type: "success" });
      setShowDescartarDialog(false);
      refresh();
    } catch (error) {
      notify("Error al descartar la oportunidad", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompletar = async (data: any) => {
    setIsProcessing(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { ...data, estado: "1-abierta" },
        previousData: record,
      });
      notify("Oportunidad completada y movida a Abierta", { type: "success" });
      setShowCompletarDialog(false);
      refresh();
    } catch (error) {
      notify("Error al completar la oportunidad", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCerrarOportunidad = async () => {
    if (!perderMotivoId) {
      notify("Seleccioná un motivo de pérdida.", { type: "warning" });
      return;
    }
    setIsProcessing(true);
    try {
      const data: Record<string, unknown> = {
        motivo_perdida_id: Number(perderMotivoId),
        estado: "6-perdida",
        fecha_estado: new Date().toISOString(),
      };
      if (perderNota.trim()) {
        data.descripcion_estado = perderNota.trim();
      }
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data,
        previousData: record,
      });
      notify("Oportunidad marcada como pérdida", { type: "success" });
      setShowCerrarDialog(false);
      setPerderMotivoId("");
      setPerderNota("");
      refresh();
    } catch (error) {
      notify("No se pudo cerrar la oportunidad", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAgendarVisita = async () => {
    const { titulo, descripcion, tipoEvento, datetime, asignadoId } = visitaForm;
    if (!titulo.trim()) {
      notify("Ingresa un título para la visita.", { type: "warning" });
      return;
    }
    if (!datetime) {
      notify("Selecciona fecha y hora.", { type: "warning" });
      return;
    }
    if (!asignadoId) {
      notify("Selecciona el responsable.", { type: "warning" });
      return;
    }

    const payload: Record<string, unknown> = {
      oportunidad_id: record.id,
      fecha_evento: new Date(datetime).toISOString(),
      titulo: titulo.trim(),
      tipo_evento: tipoEvento,
      estado_evento: DEFAULT_EVENT_STATE,
      asignado_a_id: Number(asignadoId),
    };
    if (descripcion.trim()) {
      payload.descripcion = descripcion.trim();
    }

    setIsProcessing(true);
    try {
      await dataProvider.create("crm/eventos", { data: payload });
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { estado: "2-visita", fecha_estado: new Date().toISOString() },
        previousData: record,
      });
      notify("Visita agendada y oportunidad confirmada", { type: "success" });
      setShowVisitaDialog(false);
      refresh();
    } catch (error) {
      notify("No se pudo agendar la visita", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCotizarSubmit = async () => {
    setIsProcessing(true);
    try {
      const payload: Record<string, unknown> = {
        estado: "3-cotiza",
        fecha_estado: new Date().toISOString(),
      };
      const toNumber = (value: string) => (value ? Number(value) : null);
      payload.propiedad_id = toNumber(cotizarForm.propiedadId);
      payload.tipo_propiedad_id = toNumber(cotizarForm.tipoPropiedadId);
      payload.moneda_id = toNumber(cotizarForm.monedaId);
      payload.condicion_pago_id = toNumber(cotizarForm.condicionPagoId);
      payload.monto = cotizarForm.monto ? Number(cotizarForm.monto) : null;
      const descripcion = cotizarForm.formaPagoDescripcion.trim();
      if (descripcion) {
        payload.forma_pago_descripcion = descripcion;
      }

      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: payload,
        previousData: record,
      });
      notify("Oportunidad actualizada a Cotiza", { type: "success" });
      setShowCotizarDialog(false);
      refresh();
    } catch (error) {
      notify("No se pudo actualizar la oportunidad", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  // @ts-ignore - contacto está expandido en la respuesta
  const contactoNombre = record.contacto?.nombre_completo || `Contacto #${record.contacto_id}`;
  
  const isProspect = record.estado === "0-prospect";
  const isOpen = record.estado === "1-abierta";
  const isVisit = record.estado === "2-visita";
  const isCotiza = record.estado === "3-cotiza";
  const isReserva = record.estado === "4-reserva";
  const isGanada = record.estado === "5-ganada";
  const isPerdida = record.estado === "6-perdida";
  const accentState = isProspect || isOpen || isVisit || isCotiza || isReserva;

  const handleArchivar = async () => {
    setIsProcessing(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { activo: false },
        previousData: record,
      });
      notify("Oportunidad archivada", { type: "success" });
      setShowArchivarDialog(false);
      refresh();
    } catch (error) {
      notify("No se pudo archivar la oportunidad", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => onDragStart(event, record.id)}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          handleOpen();
        }
      }}
      className={cn(
        "cursor-pointer rounded-2xl border p-3 text-left shadow-sm transition hover:border-slate-400 hover:shadow-md focus:outline-none",
        accentState
          ? "border-sky-200 bg-gradient-to-br from-white via-sky-50/85 to-sky-100/70 shadow-sky-100/50"
          : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
        <span>#{record.id}</span>
        <Badge variant="outline" className={cn("border-transparent text-[10px] font-semibold", estadoClass)}>
          {formatEstadoOportunidad(record.estado)}
        </Badge>
      </div>
      <div className="mt-1 flex items-start gap-2">
        {accentState ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-sky-600 shadow-inner">
            <ArrowRightCircle className="h-4 w-4" />
          </span>
        ) : null}
        <div className="flex-1">
          <p className="text-xs font-bold text-foreground line-clamp-2">
            {record.titulo || "Sin t?tulo"}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {contactoNombre}
          </p>
        </div>
      </div>
      {isProspect && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-sky-200/70 bg-white/80 p-2 text-[10px]">
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 flex-1 text-[10px] text-slate-500 border-slate-200 px-1.5 hover:bg-slate-50"
              onClick={(e) => {
                e.stopPropagation();
                setShowDescartarDialog(true);
              }}
            >
              <X className="h-3 w-3 mr-0" />
              Cerrar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 flex-1 text-[10px] text-sky-700 border-sky-200 bg-white/80 px-1.5 hover:bg-sky-50"
              onClick={(e) => {
                e.stopPropagation();
                setShowCompletarDialog(true);
              }}
            >
              <ArrowRightCircle className="h-3 w-3 mr-0" />
              Aceptar
            </Button>
          </div>
        </div>
      )}
      {isOpen && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-sky-200/70 bg-white/80 p-2 text-[10px]">
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 flex-1 text-[10px] text-slate-500 border-slate-200 px-1.5 hover:bg-slate-50"
              onClick={(e) => {
                e.stopPropagation();
                setShowCerrarDialog(true);
              }}
            >
              <X className="h-3 w-3 mr-0" />
              Cerrar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 flex-1 text-[10px] text-sky-700 border-sky-200 bg-white/80 px-1.5 hover:bg-sky-50"
              onClick={(e) => {
                e.stopPropagation();
                setShowVisitaDialog(true);
              }}
            >
              <CalendarPlus className="h-3 w-3 mr-0" />
              Agendar
            </Button>
          </div>
        </div>
      )}
      {(isVisit || isCotiza || isReserva) && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-sky-200/70 bg-white/80 p-2 text-[10px]">
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 flex-1 text-[10px] text-slate-500 border-slate-200 px-1.5 hover:bg-slate-50"
              onClick={(e) => {
                e.stopPropagation();
                setShowCerrarDialog(true);
              }}
            >
              <X className="h-3 w-3 mr-0" />
              Cerrar
            </Button>
            {isVisit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 flex-1 text-[10px] text-sky-700 border-sky-200 bg-white/80 px-1.5 hover:bg-sky-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCotizarDialog(true);
                }}
              >
                <ArrowRightCircle className="h-3 w-3 mr-0" />
                Cotizar
              </Button>
            )}
          </div>
        </div>
      )}
      {(isGanada || isPerdida) && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white/85 p-2 text-[10px]">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 text-[10px] text-slate-600 border-slate-200 px-1.5 hover:bg-slate-50"
            onClick={(e) => {
              e.stopPropagation();
              setShowArchivarDialog(true);
            }}
          >
            <Archive className="mr-1 h-3 w-3" />
            Archivar
          </Button>
        </div>
      )}
      
      <Dialog open={showDescartarDialog} onOpenChange={setShowDescartarDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Descartar oportunidad</DialogTitle>
            <DialogDescription>
              Esta acci?n marcar? la oportunidad como inactiva. Podr?s reactivarla m?s tarde si es necesario.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDescartarDialog(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDescartar}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Descartar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArchivarDialog} onOpenChange={setShowArchivarDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Archivar oportunidad</DialogTitle>
            <DialogDescription>
              Esta acción oculta la oportunidad del panel manteniendo el historial intacto. ¿Deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchivarDialog(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleArchivar} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Archivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCerrarDialog} onOpenChange={setShowCerrarDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Cerrar oportunidad como perdida</DialogTitle>
            <DialogDescription>Selecciona el motivo y confirma el cierre.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-left">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Motivo *</Label>
              <select
                value={perderMotivoId}
                onChange={(event) => setPerderMotivoId(event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                <option value="">Selecciona motivo</option>
                {(motivosPerdida ?? []).map((motivo: any) => (
                  <option key={motivo.id} value={motivo.id}>
                    {motivo.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Notas</Label>
              <textarea
                rows={3}
                value={perderNota}
                onChange={(event) => setPerderNota(event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
                placeholder="Informaci?n adicional (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCerrarDialog(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleCerrarOportunidad} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cerrar oportunidad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompletarOportunidadDialog
        open={showCompletarDialog}
        onOpenChange={setShowCompletarDialog}
        record={record}
        onComplete={handleCompletar}
        isProcessing={isProcessing}
      />

      <Dialog open={showVisitaDialog} onOpenChange={setShowVisitaDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agendar visita</DialogTitle>
            <DialogDescription>Crea un evento de visita y avanza al siguiente estado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1 text-left">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">T?tulo *</Label>
              <input
                type="text"
                value={visitaForm.titulo}
                onChange={(event) => setVisitaForm((prev) => ({ ...prev, titulo: event.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Tipo *</Label>
                <select
                  value={visitaForm.tipoEvento}
                  onChange={(event) => setVisitaForm((prev) => ({ ...prev, tipoEvento: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
                >
                  {EVENT_TYPE_CHOICES.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Fecha y hora *</Label>
                <input
                  type="datetime-local"
                  value={visitaForm.datetime}
                  onChange={(event) => setVisitaForm((prev) => ({ ...prev, datetime: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Asignado a *</Label>
              <select
                value={visitaForm.asignadoId}
                onChange={(event) => setVisitaForm((prev) => ({ ...prev, asignadoId: event.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                <option value="">Selecciona responsable</option>
                {responsables.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Descripci?n</Label>
              <textarea
                rows={3}
                value={visitaForm.descripcion}
                onChange={(event) => setVisitaForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
                placeholder="Notas adicionales de la visita"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVisitaDialog(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button onClick={handleAgendarVisita} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agendar visita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCotizarDialog} onOpenChange={setShowCotizarDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Actualizar cotización</DialogTitle>
            <DialogDescription>Completa los datos de cotización para avanzar la oportunidad.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1 text-left">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Propiedad</Label>
                <select
                  value={cotizarForm.propiedadId}
                  onChange={(event) => setCotizarForm((prev) => ({ ...prev, propiedadId: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
                >
                  <option value="">Sin asignar</option>
                  {propiedades.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Tipo de propiedad</Label>
                <select
                  value={cotizarForm.tipoPropiedadId}
                  onChange={(event) =>
                    setCotizarForm((prev) => ({ ...prev, tipoPropiedadId: event.target.value }))
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
                >
                  <option value="">Sin asignar</option>
                  {tiposPropiedad.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Monto</Label>
                <input
                  type="number"
                  value={cotizarForm.monto}
                  onChange={(event) => setCotizarForm((prev) => ({ ...prev, monto: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Moneda</Label>
                <select
                  value={cotizarForm.monedaId}
                  onChange={(event) => setCotizarForm((prev) => ({ ...prev, monedaId: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
                >
                  <option value="">Sin asignar</option>
                  {monedas.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Condición de pago</Label>
              <select
                value={cotizarForm.condicionPagoId}
                onChange={(event) => setCotizarForm((prev) => ({ ...prev, condicionPagoId: event.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                <option value="">Sin asignar</option>
                {condicionesPago.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Detalle forma de pago</Label>
              <textarea
                rows={3}
                value={cotizarForm.formaPagoDescripcion}
                onChange={(event) =>
                  setCotizarForm((prev) => ({ ...prev, formaPagoDescripcion: event.target.value }))
                }
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200"
                placeholder="Notas adicionales"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCotizarDialog(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button onClick={handleCotizarSubmit} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar y avanzar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

const StageNavigator = ({
  windowLabel,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  windowLabel: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) => (
  <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-3 py-1.5 shadow-sm">
    <Button
      type="button"
      variant={canPrev ? "outline" : "ghost"}
      size="sm"
      className={cn(
        "h-8 rounded-full px-3 text-xs font-semibold uppercase tracking-wide",
        canPrev ? "text-slate-900" : "text-slate-400",
      )}
      onClick={onPrev}
      disabled={!canPrev}
      aria-label="Etapas anteriores"
    >
      <ChevronLeft className="h-4 w-4" />
      <span className="ml-1 hidden sm:inline">Anterior</span>
    </Button>
    <span className="sr-only">{windowLabel}</span>
    <Button
      type="button"
      variant={canNext ? "outline" : "ghost"}
      size="sm"
      className={cn(
        "h-8 rounded-full px-3 text-xs font-semibold uppercase tracking-wide",
        canNext ? "text-slate-900" : "text-slate-400",
      )}
      onClick={onNext}
      disabled={!canNext}
      aria-label="Etapas siguientes"
    >
      <span className="mr-1 hidden sm:inline">Siguiente</span>
      <ChevronRight className="h-4 w-4" />
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
      title={<ResourceTitle icon={Target} text="CRM - Panel" />}
      filters={filters}
      filterDefaultValues={{ estado: INITIAL_STAGE_ESTADOS }}
      actions={<ListActions />}
      perPage={500}
      sort={{ field: "fecha_estado", order: "DESC" }}
      showBreadcrumb={false}
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
