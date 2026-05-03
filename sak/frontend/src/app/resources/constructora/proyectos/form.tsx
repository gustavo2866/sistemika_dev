"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ListBase,
  required,
  useGetList,
  useGetOne,
  useRecordContext,
} from "ra-core";
import { useWatch } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

import { CRMChatShow } from "@/app/resources/crm/crm-chat";
import { CRMEventoListBody, MinimalActivosToggleFilter } from "@/app/resources/crm/crm-eventos/list";
import { ProyectoAvanceList } from "@/app/resources/constructora/proyecto-avance";
import { ProyPresupuestoList } from "@/app/resources/constructora/proy-presupuesto/List";
import { PoOrderList } from "@/app/resources/po/po-orders/List";
import { CreateButton } from "@/components/create-button";
import { appendFilterParam, buildOportunidadFilter } from "@/lib/oportunidad-context";
import { cn } from "@/lib/utils";
import { SimpleForm } from "@/components/simple-form";
import { NumberField } from "@/components/number-field";
import {
  FormDate,
  FormErrorSummary,
  FormOrderToolbar,
  FormNumber,
  FormSelect,
  FormText,
  FormTextarea,
  FormValue,
  SectionBaseTemplate,
  usePersistedActiveSection,
} from "@/components/forms/form_order";
import { ReferenceInput } from "@/components/reference-input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  PROYECTO_DEFAULTS,
  PROYECTO_ESTADO_CHOICES,
  PROYECTO_VALIDATIONS,
  getProyectoUltimoAvance,
  proyectoSchema,
  type ProyectoFormValues,
} from "./model";

const resolveNumericId = (value: unknown) => {
  if (value == null || value === "") return undefined;
  if (typeof value === "object") {
    const candidate =
      (value as { id?: unknown; value?: unknown }).id ??
      (value as { value?: unknown }).value;
    return resolveNumericId(candidate);
  }
  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : undefined;
};

const toNumber = (value: unknown) => {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
};

const DESKTOP_LAYOUT_BREAKPOINT = 1024;
const PROYECTO_ACTIVE_SECTION_STORAGE_KEY_PREFIX = "proyectos-form-active-section";

type ProyectoDesktopSectionId =
  | "presupuesto"
  | "certificados"
  | "ordenes"
  | "chat"
  | "eventos";

type ProyectoSectionVariant = "stacked" | "panel";

const PROYECTO_DESKTOP_SECTIONS: Array<{
  id: ProyectoDesktopSectionId;
  label: string;
}> = [
  { id: "presupuesto", label: "Presupuesto" },
  { id: "certificados", label: "Certificados" },
  { id: "ordenes", label: "Ordenes" },
  { id: "chat", label: "Chat" },
  { id: "eventos", label: "Eventos" },
];

const useProyectoDesktopLayout = () => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= DESKTOP_LAYOUT_BREAKPOINT;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const query = `(min-width: ${DESKTOP_LAYOUT_BREAKPOINT}px)`;
    const mediaQuery = window.matchMedia(query);
    const updateLayout = () => setIsDesktop(mediaQuery.matches);

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  return isDesktop;
};

const ProyectoDesktopPanel = ({
  title,
  description,
  actions,
  toolbar,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) => (
  <section className="flex min-h-[28rem] flex-col">
    {title || description || actions || toolbar ? (
      <div className="border-b border-border/50 px-4 py-3 xl:px-5">
        {title || description || actions ? (
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              {title ? (
                <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
              ) : null}
              {description ? (
                <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </div>
        ) : null}
        {toolbar ? <div className={cn("flex min-w-0", (title || description || actions) && "mt-2")}>{toolbar}</div> : null}
      </div>
    ) : null}
    <div className="min-w-0 overflow-x-auto px-4 py-4 xl:px-6 xl:py-5">{children}</div>
  </section>
);

const ProyectoDesktopEmptyState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
    {message}
  </div>
);

const ProyectoOportunidadField = () => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const oportunidadId = useWatch({ name: "oportunidad_id" }) as number | string | null | undefined;
  const resolvedOportunidadId = resolveNumericId(oportunidadId);

  const oportunidadLabel = record?.id
    ? resolvedOportunidadId
      ? String(resolvedOportunidadId)
      : "Sin oportunidad"
    : "Se genera al guardar";

  return (
    <FormValue
      label="Oportunidad"
      widthClass="w-full"
      valueClassName="justify-start text-left"
    >
      {oportunidadLabel}
    </FormValue>
  );
};

const ProyectoChatSection = ({
  variant = "stacked",
}: {
  variant?: ProyectoSectionVariant;
}) => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const oportunidadId = resolveNumericId(record?.oportunidad_id);

  const content = oportunidadId ? (
    <CRMChatShow forcedId={`op-${oportunidadId}`} embedded />
  ) : (
    <ProyectoDesktopEmptyState message="El chat estara disponible despues de guardar el proyecto y generar la oportunidad." />
  );

  if (variant === "panel") {
    return (
      <ProyectoDesktopPanel
        title="Chat"
        description="Conversacion y seguimiento contextual vinculado a la oportunidad del proyecto."
      >
        {content}
      </ProyectoDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title="Chat"
      defaultOpen={false}
      persistKey={`constructora-proyectos-chat-${record?.id ?? "nuevo"}`}
      main={content}
    />
  );
};

const ProyectoEventosSection = ({
  variant = "stacked",
}: {
  variant?: ProyectoSectionVariant;
}) => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const oportunidadId = resolveNumericId(record?.oportunidad_id);
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = `${location.pathname}${location.search}`;

  const { data: oportunidadData } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadId ?? 0 },
    { enabled: Boolean(oportunidadId) },
  );

  const defaultFilters = useMemo(
    () =>
      oportunidadId
        ? {
            default_scope: "pendientes_mes",
            oportunidad_id: oportunidadId,
            solo_pendientes: true,
          }
        : undefined,
    [oportunidadId],
  );

  const createTo = useMemo(() => {
    if (!oportunidadId) return "";
    const basePath = "/crm/crm-eventos/create";
    const params = new URLSearchParams();
    appendFilterParam(
      params,
      buildOportunidadFilter(
        oportunidadId,
        (oportunidadData as { contacto_id?: number | null } | undefined)?.contacto_id
          ? { contacto_id: (oportunidadData as { contacto_id?: number }).contacto_id }
          : undefined,
      ),
    );
    params.set("returnTo", returnTo);
    return `${basePath}?${params.toString()}`;
  }, [oportunidadData, oportunidadId, returnTo]);

  if (!oportunidadId) {
    if (variant === "panel") {
      return (
        <ProyectoDesktopPanel
          title="Eventos"
          description="Agenda comercial y operativa asociada a la oportunidad del proyecto."
        >
          <ProyectoDesktopEmptyState message="Los eventos estaran disponibles despues de guardar el proyecto y generar la oportunidad." />
        </ProyectoDesktopPanel>
      );
    }
    return null;
  }

  return (
    <ListBase
      resource="crm/crm-eventos"
      perPage={200}
      sort={{ field: "fecha_evento", order: "DESC" }}
      filterDefaultValues={defaultFilters}
      disableSyncWithLocation
      storeKey={`crm-eventos-proyecto-${oportunidadId}`}
    >
      {variant === "panel" ? (
        <ProyectoDesktopPanel
          title="Eventos"
          description="Agenda comercial y operativa asociada a la oportunidad del proyecto."
          actions={
            <CreateButton to={createTo} label="Agregar evento" />
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-start">
              <MinimalActivosToggleFilter source="solo_pendientes" />
            </div>
            <CRMEventoListBody
              fromChat={false}
              fromOportunidad
              oportunidadIdFilter={oportunidadId}
              showContextHeader={false}
              compact
            />
          </div>
        </ProyectoDesktopPanel>
      ) : (
        <SectionBaseTemplate
          title="Eventos"
          defaultOpen={false}
          persistKey={`constructora-proyectos-eventos-${oportunidadId}`}
          headerSummary={(isOpen) =>
            isOpen ? <MinimalActivosToggleFilter source="solo_pendientes" /> : null
          }
          headerSummaryClassName="flex items-center"
          actions={
            <DropdownMenuItem
              onSelect={(event) => {
                event.stopPropagation();
                navigate(createTo);
              }}
              className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
            >
              <Plus className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
              Agregar evento
            </DropdownMenuItem>
          }
          main={
            <CRMEventoListBody
              fromChat={false}
              fromOportunidad
              oportunidadIdFilter={oportunidadId}
              showContextHeader={false}
              compact
            />
          }
        />
      )}
    </ListBase>
  );
};

const ProyectoOrdenesSection = ({
  variant = "stacked",
}: {
  variant?: ProyectoSectionVariant;
}) => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const oportunidadId = resolveNumericId(record?.oportunidad_id);
  const location = useLocation();

  const createTo = useMemo(() => {
    if (!oportunidadId) return "";
    const basePath = "/po-orders/create";
    const params = new URLSearchParams();
    params.set("oportunidad_id", String(oportunidadId));
    params.set("lock_oportunidad", "1");
    params.set("lock_centro", "1");
    params.set("returnTo", `${location.pathname}${location.search}`);
    return `${basePath}?${params.toString()}`;
  }, [location.pathname, location.search, oportunidadId]);

  const defaultFilters = useMemo(
    () => ({ oportunidad_id: oportunidadId }),
    [oportunidadId],
  );

  if (!oportunidadId) {
    if (variant === "panel") {
      return (
        <ProyectoDesktopPanel
          title="Ordenes"
          description="Ordenes de compra y seguimiento de abastecimiento ligadas al proyecto."
        >
          <ProyectoDesktopEmptyState message="Las ordenes estaran disponibles despues de guardar el proyecto y generar la oportunidad." />
        </ProyectoDesktopPanel>
      );
    }
    return null;
  }

  const list = (
    <PoOrderList
      embedded
      filterDefaultValues={defaultFilters}
      createTo={createTo}
      storeKey={`po-orders-proyecto-${oportunidadId}`}
    />
  );

  if (variant === "panel") {
    return (
      <ProyectoDesktopPanel
        title="Ordenes"
        description="Ordenes de compra y seguimiento de abastecimiento ligadas al proyecto."
      >
        {list}
      </ProyectoDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title="Ordenes"
      defaultOpen={false}
      persistKey={`constructora-proyectos-ordenes-${oportunidadId}`}
      main={list}
    />
  );
};

const ProyectoCertificadosSection = ({
  variant = "stacked",
}: {
  variant?: ProyectoSectionVariant;
}) => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const proyectoId = resolveNumericId(record?.id);
  const location = useLocation();

  const createTo = useMemo(() => {
    if (!proyectoId) return "";
    const params = new URLSearchParams();
    params.set("proyecto_id", String(proyectoId));
    params.set("returnTo", `${location.pathname}${location.search}`);
    return `/proyecto-avance/create?${params.toString()}`;
  }, [location.pathname, location.search, proyectoId]);

  if (!proyectoId) {
    const placeholder = (
      <ProyectoDesktopEmptyState message="Los certificados estaran disponibles despues de guardar el proyecto." />
    );

    if (variant === "panel") {
      return (
        <ProyectoDesktopPanel
          title="Certificados"
          description="Registro historico de avances, horas e importes certificados del proyecto."
        >
          {placeholder}
        </ProyectoDesktopPanel>
      );
    }

    return (
      <SectionBaseTemplate
        title="Certificados"
        defaultOpen={false}
        main={placeholder}
      />
    );
  }

  const list = (
    <ProyectoAvanceList
      embedded
      filterDefaultValues={{ proyecto_id: proyectoId }}
      createTo={createTo}
      storeKey={`proyecto-avance-proyecto-${proyectoId}`}
    />
  );

  if (variant === "panel") {
    return (
      <ProyectoDesktopPanel
        title="Certificados"
        description="Registro historico de avances, horas e importes certificados del proyecto."
      >
        {list}
      </ProyectoDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title="Certificados"
      defaultOpen={false}
      persistKey={`constructora-proyectos-certificados-${proyectoId}`}
      main={list}
    />
  );
};

const ProyectoPresupuestoSection = ({
  variant = "stacked",
}: {
  variant?: ProyectoSectionVariant;
}) => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const proyectoId = resolveNumericId(record?.id);
  const location = useLocation();

  const createTo = useMemo(() => {
    if (!proyectoId) return "";
    const params = new URLSearchParams();
    params.set("proyecto_id", String(proyectoId));
    params.set("returnTo", `${location.pathname}${location.search}`);
    return `/proy-presupuestos/create?${params.toString()}`;
  }, [location.pathname, location.search, proyectoId]);

  if (!proyectoId) {
    const placeholder = (
      <ProyectoDesktopEmptyState message="El presupuesto estara disponible despues de guardar el proyecto." />
    );

    if (variant === "panel") {
      return (
        <ProyectoDesktopPanel
          title="Presupuesto"
          description="Consulta la evolucion economica y los presupuestos cargados para este proyecto."
        >
          {placeholder}
        </ProyectoDesktopPanel>
      );
    }

    return (
      <SectionBaseTemplate
        title="Presupuesto"
        defaultOpen={false}
        main={placeholder}
      />
    );
  }

  const list = (
    <ProyPresupuestoList
      embedded
      filterDefaultValues={{ proyecto_id: proyectoId }}
      createTo={createTo}
      storeKey={`proy-presupuestos-proyecto-${proyectoId}`}
    />
  );

  if (variant === "panel") {
    return (
      <ProyectoDesktopPanel
        title="Presupuesto"
        description="Consulta la evolucion economica y los presupuestos cargados para este proyecto."
      >
        {list}
      </ProyectoDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title="Presupuesto"
      defaultOpen={false}
      persistKey={`constructora-proyectos-presupuesto-${proyectoId}`}
      main={list}
    />
  );
};

const ProyectoCabeceraMainFields = () => (
  <div className="grid gap-2 md:grid-cols-4">
    <FormText
      source="nombre"
      label="Nombre"
      validate={required()}
      widthClass="w-full"
      className="md:col-span-2"
      maxLength={PROYECTO_VALIDATIONS.NOMBRE_MAX}
    />
    <FormSelect
      source="estado"
      label="Estado"
      choices={PROYECTO_ESTADO_CHOICES}
      validate={required()}
      widthClass="w-full"
    />
    <ReferenceInput source="responsable_id" reference="users" label="Responsable">
      <FormSelect
        optionText="nombre"
        label="Responsable"
        validate={required()}
        widthClass="w-full"
      />
    </ReferenceInput>
  </div>
);

const ProyectoCabeceraOptionalFields = () => (
  <div className="mt-1 rounded-md border border-muted/60 bg-muted/30 p-2">
    <div className="grid gap-2 md:grid-cols-4">
      <div className="md:col-span-2">
        <ProyectoOportunidadField />
      </div>
      <FormNumber
        source="centro_costo"
        label="Centro de costo"
        step="1"
        widthClass="w-full"
      />
      <FormDate
        source="fecha_inicio"
        label="Fecha de inicio"
        widthClass="w-full"
      />
      <FormDate
        source="fecha_final"
        label="Fecha final"
        widthClass="w-full"
      />
      <FormNumber
        source="superficie"
        label="Superficie %"
        step="0.01"
        widthClass="w-full"
      />
      <FormNumber
        source="ingresos"
        label="Ingresos"
        step="0.01"
        widthClass="w-full"
      />
      <FormNumber
        source="importe_mat"
        label="Materiales"
        step="0.01"
        widthClass="w-full"
      />
      <FormNumber
        source="importe_mo"
        label="Mano de obra"
        step="0.01"
        widthClass="w-full"
      />
      <FormNumber
        source="terceros"
        label="Terceros"
        step="0.01"
        widthClass="w-full"
      />
      <FormNumber
        source="herramientas"
        label="Herramientas"
        step="0.01"
        widthClass="w-full"
      />
      <FormTextarea
        source="comentario"
        label="Comentario"
        widthClass="w-full md:col-span-4"
        className="md:col-span-4 [&_textarea]:min-h-[72px]"
        maxLength={PROYECTO_VALIDATIONS.COMENTARIO_MAX}
      />
    </div>
  </div>
);

const ResumenProyecto = ({ className }: { className?: string }) => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const proyectoId = resolveNumericId(record?.id);

  const { data: presupuestos = [] } = useGetList(
    "proy-presupuestos",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "fecha", order: "DESC" },
      filter: { proyecto_id: proyectoId ?? -1 },
    },
  );
  const { data: avances = [] } = useGetList(
    "proyecto-avance",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "fecha_registracion", order: "DESC" },
      filter: { proyecto_id: proyectoId ?? -1 },
    },
  );

  const presupuesto = presupuestos.reduce(
    (acc, item) =>
      acc +
      toNumber(item.mo_propia) +
      toNumber(item.mo_terceros) +
      toNumber(item.materiales) +
      toNumber(item.herramientas),
    0,
  );
  const ingresos = presupuestos.reduce((acc, item) => acc + toNumber(item.importe), 0);
  const horas = presupuestos.reduce((acc, item) => acc + toNumber(item.horas), 0);
  const avanceActual = getProyectoUltimoAvance(avances);

  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto rounded-md border border-muted/60 bg-muted/30 px-2 py-2 text-[8px] text-muted-foreground sm:gap-3 sm:px-3 sm:py-2 sm:text-[10px]",
        className,
      )}
    >
      <span className="flex items-center gap-1 whitespace-nowrap min-w-0">
        Presupuesto:
        <NumberField
          source="presupuesto"
          record={{ presupuesto }}
          options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          className="text-foreground tabular-nums"
        />
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap min-w-0">
        Ingresos:
        <NumberField
          source="ingresos"
          record={{ ingresos: Number(ingresos ?? 0) }}
          options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          className="text-foreground tabular-nums"
        />
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap min-w-0">
        Horas:
        <NumberField
          source="horas"
          record={{ horas }}
          options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
          className="text-foreground tabular-nums"
        />
      </span>
      <span className="flex items-center justify-center gap-1.5 rounded-full bg-foreground/90 px-2 py-1 text-[8px] font-semibold text-background whitespace-nowrap sm:justify-start sm:px-2.5 sm:py-1 sm:text-[10px]">
        Avance:
        <NumberField
          source="avance"
          record={{ avance: avanceActual }}
          options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
          className="tabular-nums"
        />
        %
      </span>
    </div>
  );
};

const ProyectoStickyFooter = () => (
  <div className="sticky -bottom-6 z-20 mt-2 border-t border-border/60 bg-background/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/85">
    <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-2.5">
      <ResumenProyecto className="min-w-0 sm:flex-nowrap" />
      <FormOrderToolbar
        className="shrink-0 justify-end flex-nowrap"
        saveProps={{ variant: "secondary" }}
      />
    </div>
  </div>
);

const ProyectoDesktopSectionsLayout = ({
  activeSection,
  onSectionChange,
}: {
  activeSection: ProyectoDesktopSectionId;
  onSectionChange: (sectionId: ProyectoDesktopSectionId) => void;
}) => {
  const activeConfig =
    PROYECTO_DESKTOP_SECTIONS.find((section) => section.id === activeSection) ??
    PROYECTO_DESKTOP_SECTIONS[0];

  const renderActiveSection = () => {
    switch (activeSection) {
      case "presupuesto":
        return <ProyectoPresupuestoSection variant="panel" />;
      case "certificados":
        return <ProyectoCertificadosSection variant="panel" />;
      case "ordenes":
        return <ProyectoOrdenesSection variant="panel" />;
      case "chat":
        return <ProyectoChatSection variant="panel" />;
      case "eventos":
        return <ProyectoEventosSection variant="panel" />;
      default:
        return null;
    }
  };

  return (
    <div className="hidden rounded-[28px] border border-border/60 bg-card/90 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] lg:grid lg:grid-cols-[98px_minmax(0,1fr)]">
      <aside className="border-r border-border/50 bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.96)_100%)] p-2">
        <div className="flex flex-col gap-1">
          {PROYECTO_DESKTOP_SECTIONS.map((section) => {
            const isActive = section.id === activeSection;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "group mr-[-10px] flex min-h-[34px] items-center justify-center rounded-l-lg rounded-r-none border border-r-0 px-2 py-1 text-center transition-all",
                  isActive
                    ? "-translate-x-2 border-border/80 bg-background text-foreground shadow-[10px_12px_30px_-24px_rgba(15,23,42,0.45)]"
                    : "border-transparent bg-muted/50 text-slate-500 hover:bg-muted/80 hover:text-slate-700",
                )}
                aria-pressed={isActive}
              >
                <span className="whitespace-normal break-words text-[10px] font-semibold leading-[1.05]">
                  {section.label}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="min-w-0 overflow-x-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(249,250,251,0.96)_100%)]">
        <div className="sr-only">{activeConfig.label}</div>
        {renderActiveSection()}
      </div>
    </div>
  );
};

export const ProyectoForm = () => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const location = useLocation();
  const isDesktopLayout = useProyectoDesktopLayout();
  const activeSectionStorageKey = `${PROYECTO_ACTIVE_SECTION_STORAGE_KEY_PREFIX}:${location.pathname}`;
  const [activeSection, setActiveSection] = usePersistedActiveSection<ProyectoDesktopSectionId>({
    storageKey: activeSectionStorageKey,
    sections: PROYECTO_DESKTOP_SECTIONS.map((section) => section.id),
    defaultSection: "presupuesto",
  });
  const defaultValues = useMemo(
    () => (record?.id ? undefined : PROYECTO_DEFAULTS),
    [record?.id],
  );

  return (
    <SimpleForm<ProyectoFormValues>
      className="w-full max-w-6xl max-h-[calc(100svh-10rem)] overflow-y-auto overscroll-y-contain pr-1 pb-4 sm:max-h-[calc(100svh-9rem)]"
      resolver={zodResolver(proyectoSchema) as any}
      toolbar={<ProyectoStickyFooter />}
      defaultValues={defaultValues}
    >
      <FormErrorSummary />
      <SectionBaseTemplate
        title="Cabecera"
        main={<ProyectoCabeceraMainFields />}
        optional={<ProyectoCabeceraOptionalFields />}
        defaultOpen
      />
      {isDesktopLayout ? (
        <ProyectoDesktopSectionsLayout
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      ) : (
        <>
          <ProyectoPresupuestoSection />
          <ProyectoCertificadosSection />
          <ProyectoOrdenesSection />
          <ProyectoChatSection />
          <ProyectoEventosSection />
        </>
      )}
    </SimpleForm>
  );
};
