"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { Badge } from "@/components/ui/badge";
import { useListContext, useRecordContext, useCreatePath, useRefresh } from "ra-core";
import { SummaryChips, type SummaryChipItem } from "@/components/lists/SummaryChips";
import { ResourceTitle } from "@/components/resource-title";
import { Mail, MessageCircle, CalendarPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CRMMensaje, CRMMensajeEstado } from "./model";
import { IconButtonWithTooltip } from "@/components/icon-button-with-tooltip";
import { useNavigate } from "react-router";
import { CRMMensajeReplyDialog } from "./reply";
import {
  CRM_MENSAJE_TIPO_CHOICES,
  CRM_MENSAJE_CANAL_CHOICES,
  CRM_MENSAJE_ESTADO_CHOICES,
  CRM_MENSAJE_PRIORIDAD_CHOICES,
  CRM_MENSAJE_ESTADO_BADGES,
  formatMensajeEstado,
} from "./model";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const normalizeTipoFilter = (value: unknown): string[] => {
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

const setTipoFilterValue = (filters: Record<string, unknown>, values: string[]) => {
  if (values.length) {
    filters.tipo = values;
  } else {
    delete filters.tipo;
  }
};

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

const setEstadoFilterValue = (filters: Record<string, unknown>, values: string[]) => {
  if (values.length) {
    filters.estado = values;
  } else {
    delete filters.estado;
  }
};

const estadoChipClass = (estado: string, selected = false) => {
  const base =
    CRM_MENSAJE_ESTADO_BADGES[estado as keyof typeof CRM_MENSAJE_ESTADO_BADGES] ??
    "bg-slate-100 text-slate-800";
  return selected
    ? `${base} border-transparent ring-1 ring-offset-1 ring-offset-background`
    : `${base} border-transparent`;
};

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar mensajes" className="w-full" alwaysOn />,
  <SelectInput
    key="tipo"
    source="tipo"
    label="Tipo"
    choices={CRM_MENSAJE_TIPO_CHOICES}
    emptyText="Todos"
  />,
  <SelectInput
    key="canal"
    source="canal"
    label="Canal"
    choices={CRM_MENSAJE_CANAL_CHOICES}
    emptyText="Todos"
  />,
  <SelectInput
    key="estado"
    source="estado"
    label="Estado"
    choices={CRM_MENSAJE_ESTADO_CHOICES}
    emptyText="Todos"
  />,
  <SelectInput
    key="prioridad"
    source="prioridad"
    label="Prioridad"
    choices={CRM_MENSAJE_PRIORIDAD_CHOICES}
    emptyText="Todas"
  />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="responsable_id" source="responsable_id" reference="users" label="Responsable">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="oportunidad_id" source="oportunidad_id" reference="crm/oportunidades" label="Oportunidad">
    <SelectInput
      optionText={(record) =>
        record?.descripcion_estado ? `${record.id} - ${record.descripcion_estado}` : `#${record?.id}`
      }
      emptyText="Todas"
    />
  </ReferenceInput>,
];

const mensajeRowClass = (record: CRMMensaje) =>
  cn(
    "transition-colors hover:bg-slate-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 odd:bg-white even:bg-slate-50/60",
    record.estado === "nuevo" && "ring-1 ring-emerald-300/70 ring-offset-0"
  );

const ListActions = () => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

const TipoDualToggle = () => {
  const { filterValues, setFilters } = useListContext();
  const currentTipos = normalizeTipoFilter(filterValues.tipo);
  const currentEstados = normalizeEstadoFilter(filterValues.estado);
  const current = currentTipos[0];

  const handleToggle = (next?: string) => {
    const newFilters = { ...filterValues };
    
    if (!next) {
      // NUEVOS: filter for entrada + nuevo
      setTipoFilterValue(newFilters, ["entrada"]);
      setEstadoFilterValue(newFilters, ["nuevo"]);
    } else if (next === "entrada") {
      // ENTRADA: filter for entrada + recibido
      setTipoFilterValue(newFilters, ["entrada"]);
      setEstadoFilterValue(newFilters, ["recibido"]);
    } else if (next === "salida") {
      // SALIDA: filter for salida only (all estados)
      setTipoFilterValue(newFilters, ["salida"]);
      delete newFilters.estado;
    }
    
    setFilters(newFilters, {});
  };

  const options: Array<{ id?: CRMMensaje["tipo"]; label: string; estado: CRMMensajeEstado }> = [
    { id: undefined, label: "Nuevos", estado: "nuevo" },
    { id: "entrada", label: "Entrada", estado: "recibido" },
    { id: "salida", label: "Salida", estado: "enviado" },
  ];

  return (
    <div className="flex items-center justify-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-1 py-1 shadow-[0_1px_6px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      {options.map(({ id, label, estado }, index) => {
        // Check active state based on tipo + estado combination
        let isActive = false;
        if (!id) {
          // NUEVOS: entrada + nuevo
          isActive = current === "entrada" && currentEstados[0] === "nuevo";
        } else if (id === "entrada") {
          // ENTRADA: entrada + recibido
          isActive = current === "entrada" && currentEstados[0] === "recibido";
        } else if (id === "salida") {
          // SALIDA: salida
          isActive = current === "salida";
        }
        
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        const badgeColors =
          CRM_MENSAJE_ESTADO_BADGES[estado] ?? "bg-slate-100 text-slate-800";
        return (
          <button
            key={label}
            type="button"
            aria-pressed={isActive}
            data-active={isActive}
            onClick={() => handleToggle(id)}
            className={cn(
              "min-w-[92px] rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-wide transition-all duration-200",
              isFirst ? "rounded-l-full" : "",
              isLast ? "rounded-r-full" : "",
              isActive
                ? cn(
                    badgeColors,
                    "shadow-[0_4px_16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200"
                  )
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

const EstadoSummaryChips = () => {
  const { filterValues, setFilters } = useListContext();
  const [items, setItems] = useState<SummaryChipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const signature = JSON.stringify(filterValues);

  useEffect(() => {
    let cancel = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        Object.entries(filterValues).forEach(([key, value]) => {
          if (value == null) return;
          if (Array.isArray(value)) {
            if (!value.length) return;
            value.forEach((item) => {
              if (item != null && item !== "") {
                query.append(key, String(item));
              }
            });
            return;
          }
          if (value !== "") {
            query.append(key, String(value));
          }
        });
        const response = await fetch(
          `${API_URL}/crm/mensajes/aggregates/estado?${query.toString()}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        const raw: Array<{ estado: string; total?: number }> =
          json?.data ?? json ?? [];
        const totals = new Map<string, number>();
        raw.forEach(({ estado, total }) => {
          totals.set(estado, total ?? 0);
        });
        // Filter estados based on tipo
        const currentTipos = normalizeTipoFilter(filterValues.tipo);
        const currentTipo = currentTipos[0];
        
        // Define estados for entrada and salida
        const estadosEntrada = ["nuevo", "recibido", "descartado"];
        const estadosSalida = ["pendiente_envio", "enviado", "error_envio"];
        
        // Filter choices based on tipo
        let filteredChoices = CRM_MENSAJE_ESTADO_CHOICES;
        if (currentTipo === "entrada") {
          filteredChoices = CRM_MENSAJE_ESTADO_CHOICES.filter(choice => 
            estadosEntrada.includes(choice.id)
          );
        } else if (currentTipo === "salida") {
          filteredChoices = CRM_MENSAJE_ESTADO_CHOICES.filter(choice => 
            estadosSalida.includes(choice.id)
          );
        }
        
        const mapped: SummaryChipItem[] = filteredChoices.map(
          (choice) => ({
            label: choice.name,
            value: choice.id,
            count: totals.get(choice.id as string) ?? 0,
            chipClassName: estadoChipClass(choice.id),
            selectedChipClassName: estadoChipClass(choice.id, true),
            countClassName: "text-xs font-semibold bg-slate-100 text-slate-600",
            selectedCountClassName:
              "text-xs font-semibold bg-white/70 text-slate-900",
          })
        );
        if (!cancel) {
          setItems(mapped);
          setError(null);
        }
      } catch (err: any) {
        if (!cancel) {
          setError(err?.message ?? "No se pudieron cargar los estados");
        }
      } finally {
        if (!cancel) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      cancel = true;
    };
  }, [signature]);

  const currentEstados = normalizeEstadoFilter(filterValues.estado);

  const handleSelect = (value?: string) => {
    const nextFilters = { ...filterValues };
    setEstadoFilterValue(nextFilters, value ? [value] : []);
    setFilters(nextFilters, {});
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_40px_rgba(15,23,42,0.08)] backdrop-blur-md">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex justify-center lg:justify-start lg:flex-shrink-0">
            <TipoDualToggle />
          </div>
          <div className="flex w-full justify-center lg:flex-1 lg:justify-end">
            <SummaryChips
              className="mb-0 border-none bg-transparent p-0 shadow-none"
              title={null}
              items={items}
              loading={loading}
              error={error}
              selectedValue={currentEstados[0]}
              onSelect={handleSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const CRMMensajeList = () => {
  const [replyOpen, setReplyOpen] = useState(false);
  const [selectedMensaje, setSelectedMensaje] = useState<CRMMensaje | null>(null);
  const refresh = useRefresh();

  const handleReplyClick = (mensaje: CRMMensaje) => {
    setSelectedMensaje(mensaje);
    setReplyOpen(true);
  };

  const handleReplySuccess = () => {
    refresh();
  };

  return (
    <>
      <List
        title={<ResourceTitle icon={Mail} text="CRM - Mensajes" />}
        filters={filters}
        actions={<ListActions />}
        perPage={10}
        sort={{ field: "fecha_mensaje", order: "DESC" }}
        className="space-y-5"
      >
    <div className="space-y-6 rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-white/90 via-white/80 to-slate-50/80 p-5 shadow-[0_30px_60px_rgba(15,23,42,0.15)]">
      <EstadoSummaryChips />
      <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-4 shadow-sm transition">
        <DataTable rowClick="show" className="border-0 shadow-none" rowClassName={mensajeRowClass}>
          <DataTable.Col source="id" label="ID">
            <IdCell />
          </DataTable.Col>
      <DataTable.Col
        source="fecha_mensaje"
        label="Fecha/Hora"
        className="w-[150px] min-w-[140px]"
        cellClassName="!whitespace-normal"
      >
        <FechaCell />
      </DataTable.Col>
      <DataTable.Col source="contacto_id" label="Contacto" className="max-w-[220px]">
        <ContactoCell />
      </DataTable.Col>
      <DataTable.Col
        source="oportunidad_id"
        label="Oportunidad"
        className="w-[360px] min-w-[320px]"
        cellClassName="!whitespace-normal"
      >
        <OportunidadCell />
      </DataTable.Col>
      <DataTable.Col
        source="asunto"
        label="Asunto"
        className="w-[420px] min-w-[320px]"
        cellClassName="!whitespace-normal"
      >
        <AsuntoCell />
      </DataTable.Col>
      <DataTable.Col source="estado" label="Estado" className="w-[140px] min-w-[120px]">
        <EstadoCell />
      </DataTable.Col>
      <DataTable.Col label="Acciones" className="w-[140px] min-w-[120px] justify-center">
        <AccionesCell onReplyClick={handleReplyClick} />
      </DataTable.Col>
        </DataTable>
      </div>
    </div>
      </List>
      <CRMMensajeReplyDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        mensaje={selectedMensaje}
        onSuccess={handleReplySuccess}
      />
    </>
  );
};

const IdCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  return (
    <span className="flex items-center gap-1 text-sm font-semibold">
      #{record.id}
      {record.prioridad === "alta" ? (
        <span className="text-base font-bold leading-none text-rose-500" aria-label="Alta prioridad">
          !
        </span>
      ) : null}
    </span>
  );
};

const FechaCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record?.fecha_mensaje) {
    return <span className="text-sm text-muted-foreground">Sin fecha</span>;
  }
  const date = new Date(record.fecha_mensaje);
  return (
    <div className="flex flex-col text-sm">
      <span>{date.toLocaleDateString("es-AR")}</span>
      <span className="text-muted-foreground text-xs">{date.toLocaleTimeString("es-AR")}</span>
    </div>
  );
};

const ContactoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  return (
    <div className="flex flex-col text-sm">
      {record.contacto ? (
        <span className="font-medium">{record.contacto.nombre_completo || record.contacto.nombre}</span>
      ) : record.contacto_id ? (
        <span className="font-medium">Contacto #{record.contacto_id}</span>
      ) : (
        <span className="font-medium text-muted-foreground">Sin contacto</span>
      )}
      {record.contacto_referencia ? (
        <span className="text-xs text-muted-foreground">{record.contacto_referencia}</span>
      ) : null}
    </div>
  );
};

const AsuntoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium line-clamp-1">{record.asunto || "Sin asunto"}</p>
      {record.contenido ? (
        <p className="text-xs text-muted-foreground line-clamp-2">{record.contenido}</p>
      ) : null}
    </div>
  );
};

const OportunidadCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  const oportunidadId = record.oportunidad?.id ?? record.oportunidad_id;
  const oportunidadDescripcionRaw =
    record.oportunidad?.nombre ??
    record.oportunidad?.descripcion ??
    record.oportunidad?.descripcion_estado ??
    null;
  const oportunidadDescripcion =
    typeof oportunidadDescripcionRaw === "string" && oportunidadDescripcionRaw.length > 80
      ? `${oportunidadDescripcionRaw.slice(0, 80)}...`
      : oportunidadDescripcionRaw;
  const propiedadNombre =
    record.oportunidad?.propiedad?.nombre ??
    (record.oportunidad?.propiedad?.id ? `Propiedad #${record.oportunidad.propiedad.id}` : null);

  const principalLinea = [oportunidadId ? `#${oportunidadId}` : null, oportunidadDescripcion]
    .filter(Boolean)
    .join(" ");

  if (!principalLinea && !propiedadNombre) {
    return <span className="text-sm text-muted-foreground">Sin oportunidad</span>;
  }

  return (
    <div className="flex flex-col text-sm">
      {principalLinea ? (
        <span className="text-sm font-semibold text-foreground">{principalLinea}</span>
      ) : null}
      {propiedadNombre ? (
        <span className="text-xs text-muted-foreground">{propiedadNombre}</span>
      ) : null}
    </div>
  );
};


const EstadoCell = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;
  const estadoClass = record.estado
    ? CRM_MENSAJE_ESTADO_BADGES[record.estado]
    : "bg-slate-200 text-slate-800";
  return (
    <div className="flex flex-col gap-1 text-xs">
      <Badge variant="outline" className={`${estadoClass} border-transparent`}>
        {formatMensajeEstado(record.estado)}
      </Badge>
    </div>
  );
};

interface AccionesCellProps {
  onReplyClick: (mensaje: CRMMensaje) => void;
}

const AccionesCell = ({ onReplyClick }: AccionesCellProps) => {
  const record = useRecordContext<CRMMensaje>();
  const createPath = useCreatePath();
  const navigate = useNavigate();

  if (!record) return null;

  const goToShowAction = (action: "schedule" | "discard") => {
    const to = createPath({
      resource: "crm/mensajes",
      type: "show",
      id: record.id,
    });
    navigate(to, { state: { action } });
  };

  const handleReplyClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onReplyClick(record);
  };

  const handleShowAction =
    (action: "schedule" | "discard") => (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      goToShowAction(action);
    };

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={handleReplyClick}
        className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
      >
        <MessageCircle className="size-4" />
        <span className="text-[9px] font-medium leading-none text-muted-foreground">Responder</span>
      </button>
      <button
        type="button"
        onClick={handleShowAction("discard")}
        className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
      >
        <Trash2 className="size-4 text-destructive" />
        <span className="text-[9px] font-medium leading-none text-muted-foreground">Descartar</span>
      </button>
    </div>
  );
};
