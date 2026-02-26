"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import { List } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useDataProvider,
  useGetList,
  useListContext,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  ListColumn,
  ListDate,
  ListEstado,
  ListID,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { CompactSoloActivasToggleFilter } from "@/components/lists/solo-activas-toggle";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Pencil, Target, Trash2, Workflow } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  CRM_OPORTUNIDAD_ESTADO_CHOICES,
  CRM_OPORTUNIDAD_ESTADO_BADGES,
} from "./model";
import { CRMOportunidadesDashboard } from "./dashboard";

// === Filtros ===
const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "tipo_operacion_id",
        reference: "crm/catalogos/tipos-operacion",
        label: "Tipo operacion",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: CRM_OPORTUNIDAD_ESTADO_CHOICES,
        optionText: "name",
        optionValue: "id",
        emptyText: "Todos",
        className: "w-[80px]",
        alwaysOn: true,
      },
    },
    {
      type: "custom",
      element: (
        <CompactSoloActivasToggleFilter
          key="activo"
          source="activo"
          label="Activos"
        />
      ),
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
        className: "w-full",
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
        className: "w-full",
        emptyText: "Todas",
      },
    },
    {
      type: "text",
      props: {
        source: "propiedad.tipo",
        label: "Tipo de propiedad",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "emprendimiento_id",
        reference: "emprendimientos",
        label: "Emprendimiento",
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "crm-oportunidades" },
);

// === Acciones ===
const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const AccionesLista = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

const TIPO_OPERACION_STORAGE_KEY = "crm-oportunidades:tipo-operacion";

const TipoOperacionAlquilerDefault = () => {
  const { filterValues, setFilters } = useListContext<any>();
  const appliedRef = useRef(false);
  const { data: tiposOperacion } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const alquilerId = useMemo(() => {
    const alquiler = tiposOperacion?.find(
      (tipo: any) =>
        tipo?.codigo?.toLowerCase().includes("alquiler") ||
        tipo?.nombre?.toLowerCase().includes("alquiler")
    );
    return alquiler?.id ? String(alquiler.id) : undefined;
  }, [tiposOperacion]);

  useEffect(() => {
    if (appliedRef.current) return;
    const currentValue = filterValues?.tipo_operacion_id;
    if (currentValue) {
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(TIPO_OPERACION_STORAGE_KEY, String(currentValue));
        } catch {}
      }
      appliedRef.current = true;
      return;
    }
    const storedValue =
      typeof window !== "undefined"
        ? (() => {
            try {
              return sessionStorage.getItem(TIPO_OPERACION_STORAGE_KEY) ?? undefined;
            } catch {
              return undefined;
            }
          })()
        : undefined;
    const defaultValue = storedValue ?? alquilerId;
    if (!defaultValue) return;
    setFilters({ ...filterValues, tipo_operacion_id: defaultValue }, {});
    appliedRef.current = true;
  }, [alquilerId, filterValues, setFilters]);

  return null;
};

const OportunidadesDashboardTop = () => {
  const { filterValues, setFilters } = useListContext<any>();
  const tipoOperacionId = filterValues?.tipo_operacion_id
    ? String(filterValues.tipo_operacion_id)
    : "";
  const estadoValue = typeof filterValues?.estado === "string" ? filterValues.estado : "";
  const estadoInRaw = filterValues?.estado__in as unknown;
  const estadoInValues = useMemo(() => {
    if (Array.isArray(estadoInRaw)) {
      return estadoInRaw.map((value) => String(value));
    }
    if (typeof estadoInRaw === "string") {
      return estadoInRaw.split(",").map((value) => value.trim()).filter(Boolean);
    }
    return [];
  }, [estadoInRaw]);
  const isEnProcesoFilter =
    !estadoValue &&
    estadoInValues.length > 0 &&
    ["1-abierta", "2-visita", "3-cotiza"].every((estado) => estadoInValues.includes(estado));
  const isCerradasFilter =
    !estadoValue &&
    estadoInValues.length > 0 &&
    ["5-ganada", "6-perdida"].every((estado) => estadoInValues.includes(estado));

  const { selectedCardId, selectedBucketKey } = useMemo(() => {
    if (isEnProcesoFilter) {
      return { selectedCardId: "en_proceso", selectedBucketKey: undefined };
    }
    if (isCerradasFilter) {
      return { selectedCardId: "cerradas", selectedBucketKey: undefined };
    }
    switch (estadoValue) {
      case "0-prospect":
        return { selectedCardId: "prospect", selectedBucketKey: "prospect" };
      case "1-abierta":
        return { selectedCardId: "en_proceso", selectedBucketKey: "abierta" };
      case "2-visita":
        return { selectedCardId: "en_proceso", selectedBucketKey: "visita" };
      case "3-cotiza":
        return { selectedCardId: "en_proceso", selectedBucketKey: "cotiza" };
      case "4-reserva":
        return { selectedCardId: "reservas", selectedBucketKey: "reserva" };
      case "5-ganada":
        return { selectedCardId: "cerradas", selectedBucketKey: "ganada" };
      case "6-perdida":
        return { selectedCardId: "cerradas", selectedBucketKey: "perdida" };
      default:
        return { selectedCardId: undefined, selectedBucketKey: undefined };
    }
  }, [estadoValue, isEnProcesoFilter, isCerradasFilter]);

  useEffect(() => {
    if (!estadoValue) return;
    if (!estadoInValues.length) return;
    const next = { ...filterValues };
    if ("estado__in" in next) {
      delete next.estado__in;
      setFilters(next, {});
    }
  }, [estadoValue, estadoInValues, filterValues, setFilters]);

  const clearEstadoFilter = () => {
    const next = { ...filterValues };
    if ("estado" in next) {
      delete next.estado;
    }
    if ("estado__in" in next) {
      delete next.estado__in;
    }
    setFilters(next, {});
  };

  const applyEstadoFilter = (estado: string) => {
    const next = { ...filterValues, estado };
    if ("estado__in" in next) {
      delete next.estado__in;
    }
    setFilters(next, {});
  };

  const applyEnProcesoFilter = () => {
    const next = { ...filterValues };
    if ("estado" in next) {
      delete next.estado;
    }
    next.estado__in = ["1-abierta", "2-visita", "3-cotiza"];
    setFilters(next, {});
  };

  const applyCerradasFilter = () => {
    const next = { ...filterValues };
    if ("estado" in next) {
      delete next.estado;
    }
    next.estado__in = ["5-ganada", "6-perdida"];
    setFilters(next, {});
  };

  const handleCardClick = (payload: { cardKey?: string }) => {
    const { cardKey } = payload;
    if (!cardKey) {
      clearEstadoFilter();
      return;
    }
    if (cardKey === "prospect") {
      if (selectedCardId === cardKey) {
        clearEstadoFilter();
        return;
      }
      applyEstadoFilter("0-prospect");
      return;
    }
    if (cardKey === "reservas") {
      if (selectedCardId === cardKey) {
        clearEstadoFilter();
        return;
      }
      applyEstadoFilter("4-reserva");
      return;
    }
    if (cardKey === "en_proceso") {
      if (selectedCardId === cardKey) {
        clearEstadoFilter();
        return;
      }
      applyEnProcesoFilter();
      return;
    }
    if (cardKey === "cerradas") {
      if (selectedCardId === cardKey) {
        clearEstadoFilter();
        return;
      }
      applyCerradasFilter();
    }
  };

  const handleBucketClick = (payload: { cardKey: string; bucketKey?: string }) => {
    const { cardKey, bucketKey } = payload;
    if (!bucketKey) {
      clearEstadoFilter();
      return;
    }
    if (cardKey === "en_proceso") {
      const estadoMap: Record<string, string> = {
        abierta: "1-abierta",
        visita: "2-visita",
        cotiza: "3-cotiza",
      };
      const estado = estadoMap[bucketKey];
      if (estado) {
        applyEstadoFilter(estado);
      }
      return;
    }
    if (cardKey === "prospect") {
      applyEstadoFilter("0-prospect");
      return;
    }
    if (cardKey === "reservas") {
      applyEstadoFilter("4-reserva");
      return;
    }
    if (cardKey === "cerradas") {
      const estadoMap: Record<string, string> = {
        ganada: "5-ganada",
        perdida: "6-perdida",
      };
      const estado = estadoMap[bucketKey];
      if (estado) {
        applyEstadoFilter(estado);
      }
    }
  };

  return (
    <CRMOportunidadesDashboard
      tipoOperacionId={tipoOperacionId}
      selectedCardId={selectedCardId}
      selectedBucketKey={selectedBucketKey}
      onCardClick={handleCardClick}
      onBucketClick={handleBucketClick}
    />
  );
};

const ContactoTituloCell = () => (
  <div className="flex flex-col gap-0">
    <ReferenceField source="contacto_id" reference="crm/contactos" link={false}>
      <ListText source="nombre_completo" className="font-medium" />
    </ReferenceField>
    <ListText source="titulo" className="text-[8px] text-muted-foreground leading-tight" />
    <ReferenceField source="tipo_operacion_id" reference="crm/catalogos/tipos-operacion" link={false}>
      <ListText source="nombre" className="text-[8px] text-muted-foreground leading-tight" />
    </ReferenceField>
  </div>
);

const getInitials = (value?: string) => {
  if (!value) return "";
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
};

const ResponsableAvatar = () => {
  const record = useRecordContext<any>();
  const name = record?.nombre ?? record?.fullName ?? record?.email ?? "";
  const initials = getInitials(name);
  const avatarUrl = record?.avatar ?? record?.url_foto ?? "";

  return (
    <Avatar className="size-6 border border-slate-200">
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
      <AvatarFallback className="bg-slate-100 text-[9px] font-semibold text-slate-600">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
};

const DescripcionCell = () => {
  const record = useRecordContext<any>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(String(record?.descripcion_estado ?? ""));
  }, [open, record?.descripcion_estado]);

  if (!record) return null;

  const handleSave = async () => {
    if (!record?.id || saving) return;
    setSaving(true);
    try {
      await dataProvider.update("crm/crm-oportunidades", {
        id: record.id,
        data: { descripcion_estado: value },
        previousData: record,
      });
      notify("Descripcion actualizada", { type: "info" });
      setOpen(false);
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la descripcion", { type: "warning" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group block w-full text-left"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
            data-row-click="ignore"
            aria-label="Editar descripcion"
            title="Editar descripcion"
          >
            <span className="inline-block w-full whitespace-normal break-words line-clamp-3 rounded-sm px-1 text-[9px] text-foreground/90 transition group-hover:bg-amber-100/80">
              {record.descripcion_estado ? record.descripcion_estado : "-"}
              <Pencil className="ml-1 inline-block h-2.5 w-2.5 text-amber-700/70 opacity-0 transition group-hover:opacity-100 group-hover:text-amber-700 align-[-1px]" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          className="w-72 border-none bg-transparent p-0 shadow-none"
        >
          <SectionBaseTemplate
            title="Editar descripcion"
            main={
              <div className="space-y-2">
                <Textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="min-h-[80px] !text-[9px] !leading-tight px-2 py-1"
                  placeholder="Escribe una descripcion..."
                />
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    disabled={saving}
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    disabled={saving}
                    onClick={handleSave}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            }
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

type CRMOportunidadPoListBodyProps = {
  compact?: boolean;
  showBulkActions?: boolean;
  rowClick?: "edit" | "show" | "expand" | false | undefined;
  className?: string;
};

export const CRMOportunidadPoListBody = ({
  compact = false,
  showBulkActions = true,
  rowClick = "edit",
  className,
}: CRMOportunidadPoListBodyProps) => (
  <ResponsiveDataTable
    rowClick={rowClick}
    bulkActionsToolbar={showBulkActions ? <FormOrderBulkActionsToolbar /> : undefined}
    bulkActionButtons={showBulkActions ? undefined : false}
    compact={compact}
    rowClassName={(record: any) =>
      record?.activo === false
        ? "text-muted-foreground/70 bg-muted/20 hover:bg-muted/30"
        : undefined
    }
    className={cn(
      compact
        ? "text-[10px] [&_th]:text-[10px] [&_td]:text-[10px]"
        : "text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]",
      className,
    )}
  >
    <ListColumn source="id" label="ID" className="w-[40px] text-center">
      <ListID source="id" widthClass="w-[40px]" />
    </ListColumn>
    <ListColumn source="contacto_id" label="Contacto" className="w-[100px]">
      <ContactoTituloCell />
    </ListColumn>
    <ListColumn source="estado" label="Estado" className="w-[75px]">
      <ListEstado source="estado" statusClasses={CRM_OPORTUNIDAD_ESTADO_BADGES} />
    </ListColumn>
    <ListColumn source="responsable_id" label="Resp" className="w-[60px]">
      <ReferenceField source="responsable_id" reference="users" link={false}>
        <ResponsableAvatar />
      </ReferenceField>
    </ListColumn>
    <ListColumn source="descripcion_estado" label="Descripcion" className="w-[140px]">
      <DescripcionCell />
    </ListColumn>
    <ListColumn label="Acciones" className="w-[70px]">
      <FormOrderListRowActions
        showDelete={false}
        extraMenuItems={
          <>
            <OportunidadEliminarMenuItem />
            <OportunidadAceptarMenuItem />
            <OportunidadCambioEstadoMenu />
          </>
        }
      />
    </ListColumn>
  </ResponsiveDataTable>
);

const OportunidadEliminarMenuItem = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  const estado = String(record?.estado ?? "");
  const isProspect = estado === "0-prospect";

  if (!record?.id || !isProspect) return null;

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.stopPropagation();
        const recordPayload = {
          id: record.id,
          contacto_id: record.contacto_id,
          titulo: record.titulo,
          descripcion_estado: record.descripcion_estado,
          fecha_estado: record.fecha_estado,
          created_at: record.created_at,
        };
        navigate(`/crm/oportunidades/${record.id}/accion_descartar`, {
          state: { returnTo, record: recordPayload },
        });
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
      className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      variant="destructive"
    >
      <Trash2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Eliminar
    </DropdownMenuItem>
  );
};

const OportunidadAceptarMenuItem = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  const estado = String(record?.estado ?? "");
  const isProspect = estado === "0-prospect";

  if (!record?.id || !isProspect) return null;

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.stopPropagation();
        navigate(`/crm/oportunidades/${record.id}/accion_aceptar`, {
          state: { returnTo },
        });
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
      className="px-1.5 py-1 text-[8px] sm:text-[10px]"
    >
      <CheckCircle2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Aceptar
    </DropdownMenuItem>
  );
};

const OportunidadCambioEstadoMenu = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  const estado = String(record?.estado ?? "");
  const isClosed = estado === "5-ganada" || estado === "6-perdida";

  if (!record?.id || isClosed) return null;

  if (estado === "0-prospect") return null;

  const goTo = (path: string) => {
    navigate(path, { state: { returnTo } });
  };
  const canReservar = estado === "3-cotiza";

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        onClick={(event) => event.stopPropagation()}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      >
        <Workflow className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        Cambiar estado
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-28 sm:w-36">
        <DropdownMenuItem
          onSelect={(event) => {
            event.stopPropagation();
            goTo(`/crm/oportunidades/${record.id}/accion_agendar`);
          }}
          onClick={(event) => event.stopPropagation()}
          data-row-click="ignore"
          className="px-1.5 py-1 text-[8px] sm:text-[10px]"
        >
          Agendar
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.stopPropagation();
            goTo(`/crm/oportunidades/${record.id}/accion_cotizar`);
          }}
          onClick={(event) => event.stopPropagation()}
          data-row-click="ignore"
          className="px-1.5 py-1 text-[8px] sm:text-[10px]"
        >
          Cotizar
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.stopPropagation();
            if (!canReservar) return;
            goTo(`/crm/oportunidades/${record.id}/accion_reservar`);
          }}
          onClick={(event) => event.stopPropagation()}
          data-row-click="ignore"
          disabled={!canReservar}
          className="px-1.5 py-1 text-[8px] sm:text-[10px]"
        >
          Reservar
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.stopPropagation();
            goTo(`/crm/oportunidades/${record.id}/accion_cerrar`);
          }}
          onClick={(event) => event.stopPropagation()}
          data-row-click="ignore"
          className="px-1.5 py-1 text-[8px] sm:text-[10px]"
        >
          Cerrar
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

// === Listado ===
export const CRMOportunidadPoList = () => (
  <List
    title={
      <span className="inline-flex items-center gap-2">
        <Target className="h-4 w-4" />
        CRM Oportunidades
      </span>
    }
    filters={LIST_FILTERS}
    actions={<AccionesLista />}
    debounce={300}
    perPage={10}
    containerClassName="max-w-[980px] w-full mr-auto"
    pagination={<ListPaginator />}
    sort={{ field: "created_at", order: "DESC" }}
    filterDefaultValues={{ activo: true }}
    topContent={<OportunidadesDashboardTop />}
  >
    <TipoOperacionAlquilerDefault />
    <CRMOportunidadPoListBody />
  </List>
);

export default CRMOportunidadPoList;
