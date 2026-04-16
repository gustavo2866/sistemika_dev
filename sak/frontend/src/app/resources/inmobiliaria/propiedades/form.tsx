"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ListBase, required, useDataProvider, useGetList, useGetOne, useRecordContext } from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import {
  FormErrorSummary,
  FormNumber,
  FormOrderToolbar,
  FormSelect,
  FormText,
  FormTextarea,
  FormValue,
  ListColumn,
  ListDate,
  ListText,
  ResponsiveDataTable,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { CreateButton } from "@/components/create-button";
import { CRMChatShow } from "@/app/resources/crm/crm-chat";
import { CRMEventoListBody, MinimalActivosToggleFilter } from "@/app/resources/crm/crm-eventos/list";
import { CRMOportunidadList } from "@/app/resources/crm/crm-oportunidades/List";
import { ContratoList } from "@/app/resources/inmobiliaria/contratos/list";
import { PoOrderList } from "@/app/resources/po/po-orders/List";
import { PropiedadServicioList } from "@/app/resources/inmobiliaria/propiedades-servicios";
import { ReferenceInput } from "@/components/reference-input";
import { ReferenceField } from "@/components/reference-field";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { appendFilterParam, buildOportunidadFilter } from "@/lib/oportunidad-context";
import { cn } from "@/lib/utils";

import {
  type Propiedad,
  type PropiedadFormValues,
  excludeMantenimientoTipoOperacion,
  isTipoOperacionAlquiler,
  isTipoOperacionMantenimiento,
} from "./model";

const DESKTOP_LAYOUT_BREAKPOINT = 1024;
const PROPIEDAD_ACTIVE_SECTION_STORAGE_KEY_PREFIX = "propiedades-form-active-section";

type PropiedadDesktopSectionId =
  | "ficha"
  | "direccion"
  | "contrato"
  | "estados"
  | "oportunidades"
  | "reparaciones"
  | "servicios"
  | "ordenes"
  | "chat"
  | "eventos";

type PropiedadSectionVariant = "stacked" | "panel";

const PROPIEDAD_DESKTOP_SECTIONS: Array<{
  id: PropiedadDesktopSectionId;
  label: string;
}> = [
  { id: "ficha", label: "Ficha" },
  { id: "direccion", label: "Direccion" },
  { id: "contrato", label: "Contrato" },
  { id: "estados", label: "Estados" },
  { id: "oportunidades", label: "Oportunidades" },
  { id: "reparaciones", label: "Reparaciones" },
  { id: "servicios", label: "Servicios" },
  { id: "ordenes", label: "Ordenes" },
  { id: "chat", label: "Chat" },
  { id: "eventos", label: "Eventos" },
];

const isPropiedadDesktopSectionId = (
  value: unknown,
): value is PropiedadDesktopSectionId =>
  PROPIEDAD_DESKTOP_SECTIONS.some((section) => section.id === value);

const usePropiedadDesktopLayout = () => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= DESKTOP_LAYOUT_BREAKPOINT;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_LAYOUT_BREAKPOINT}px)`);
    const updateLayout = () => setIsDesktop(mediaQuery.matches);

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  return isDesktop;
};

const resolveNumericId = (value: unknown) => {
  if (value == null || value === "") return undefined;
  if (typeof value === "object") {
    const candidate =
      (value as { id?: unknown; value?: unknown }).id ??
      (value as { value?: unknown }).value;
    return resolveNumericId(candidate);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const useDefaultTipoOperacionId = () => {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return resolveNumericId(params.get("tipo_operacion_id"));
  }, [location.search]);
};

const useTiposOperacionCatalog = () => {
  const { data: tiposOperacion = [] } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  return tiposOperacion as Array<{ id?: unknown; nombre?: string | null; codigo?: string | null }>;
};

const TipoOperacionDefaultSync = () => {
  const record = useRecordContext<Propiedad>();
  const defaultTipoOperacionId = useDefaultTipoOperacionId();
  const { setValue } = useFormContext<PropiedadFormValues>();
  const tipoOperacionValue = useWatch({ name: "tipo_operacion_id" }) as unknown;

  useEffect(() => {
    if (record?.id || !defaultTipoOperacionId) return;
    const currentTipoOperacionId = resolveNumericId(tipoOperacionValue);
    if (currentTipoOperacionId) return;
    setValue("tipo_operacion_id", defaultTipoOperacionId, { shouldDirty: false });
  }, [defaultTipoOperacionId, record?.id, setValue, tipoOperacionValue]);

  return null;
};

const CostoMonedaDefaultSync = () => {
  const record = useRecordContext<Propiedad>();
  const { setValue } = useFormContext<PropiedadFormValues>();
  const costoMonedaValue = useWatch({ name: "costo_moneda_id" }) as unknown;
  const { data: monedas = [] } = useGetList("monedas", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "codigo", order: "ASC" },
  });

  const pesosId = useMemo(() => {
    const ars = (monedas as any[]).find(
      (moneda) => String(moneda?.codigo ?? "").toUpperCase() === "ARS",
    );
    return resolveNumericId(ars?.id);
  }, [monedas]);

  useEffect(() => {
    if (record?.id || !pesosId) return;
    const currentCostoMonedaId = resolveNumericId(costoMonedaValue);
    if (currentCostoMonedaId) return;
    setValue("costo_moneda_id", pesosId, { shouldDirty: false });
  }, [costoMonedaValue, pesosId, record?.id, setValue]);

  return null;
};

const PropiedadDesktopPanel = ({
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
  <section className="flex min-h-[24rem] flex-col">
    {title || description || actions ? (
      <div className="border-b border-border/50 px-4 py-3 xl:px-5">
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
        {toolbar ? <div className={cn("flex min-w-0", (title || description || actions) && "mt-2")}>{toolbar}</div> : null}
      </div>
    ) : null}
    <div className="min-w-0 overflow-x-auto px-4 py-4 xl:px-6 xl:py-5">{children}</div>
  </section>
);

const PropiedadDesktopEmptyState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
    {message}
  </div>
);

const PropiedadStickyFooter = () => (
  <div className="sticky -bottom-6 z-20 mt-2 border-t border-border/60 bg-background/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/85">
    <div className="flex justify-end">
      <FormOrderToolbar
        className="shrink-0 justify-end flex-nowrap"
        saveProps={{ variant: "secondary" }}
      />
    </div>
  </div>
);

export const PropiedadForm = () => {
  return (
    <SimpleForm<PropiedadFormValues>
      className="w-full max-w-6xl max-h-[calc(100svh-10rem)] overflow-y-auto overscroll-y-contain pr-1 pb-4 sm:max-h-[calc(100svh-9rem)]"
      warnWhenUnsavedChanges
      validate={useNombreUnicoFormValidator() as any}
      toolbar={<PropiedadStickyFooter />}
    >
      <TipoOperacionDefaultSync />
      <CostoMonedaDefaultSync />
      <FormErrorSummary />
      <SectionBaseTemplate
        title="Cabecera"
        main={<CabeceraFields />}
        optional={<CabeceraOpcionales />}
        defaultOpen
      />
      <PropiedadFormSectionsContent />
    </SimpleForm>
  );
};

const PropiedadFormSectionsContent = () => {
  const location = useLocation();
  const isDesktopLayout = usePropiedadDesktopLayout();
  const availableSections = useAvailablePropiedadSections();
  const activeSectionStorageKey = `${PROPIEDAD_ACTIVE_SECTION_STORAGE_KEY_PREFIX}:${location.pathname}`;
  const [activeSection, setActiveSection] = useState<PropiedadDesktopSectionId>(() => {
    if (typeof window === "undefined") return "ficha";
    const savedValue = window.sessionStorage.getItem(activeSectionStorageKey);
    return isPropiedadDesktopSectionId(savedValue) ? savedValue : "ficha";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedValue = window.sessionStorage.getItem(activeSectionStorageKey);
    if (isPropiedadDesktopSectionId(savedValue)) {
      setActiveSection(savedValue);
      return;
    }
    setActiveSection("ficha");
  }, [activeSectionStorageKey]);

  useEffect(() => {
    if (availableSections.some((section) => section.id === activeSection)) return;
    setActiveSection(availableSections[0]?.id ?? "ficha");
  }, [activeSection, availableSections]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(activeSectionStorageKey, activeSection);
  }, [activeSection, activeSectionStorageKey]);

  if (isDesktopLayout) {
    return (
      <PropiedadDesktopSectionsLayout
        activeSection={activeSection}
        availableSections={availableSections}
        onSectionChange={setActiveSection}
      />
    );
  }

  return (
    <>
      <FichaSection />
      <DireccionSection />
      {availableSections.some((section) => section.id === "contrato") ? <DatosContratoSection /> : null}
      <EstadosSection />
      <OportunidadesSection />
      <ReparacionesSection />
      <ServiciosSection />
      {availableSections.some((section) => section.id === "ordenes") ? <PropiedadOrdenesSection /> : null}
      {availableSections.some((section) => section.id === "chat") ? <PropiedadChatSection /> : null}
      {availableSections.some((section) => section.id === "eventos") ? <PropiedadEventosSection /> : null}
    </>
  );
};

const CabeceraContratoResumen = () => {
  const record = useRecordContext<Propiedad>();
  const tiposOperacion = useTiposOperacionCatalog();
  const tipoOperacionValue = useWatch({ name: "tipo_operacion_id" }) as unknown;
  const tipoActualizacionValue = useWatch({ name: "tipo_actualizacion_id" }) as unknown;
  const fechaRenovacionValue = useWatch({ name: "fecha_renovacion" }) as string | null | undefined;
  const currentTipoOperacionId =
    resolveNumericId(tipoOperacionValue) ?? resolveNumericId(record?.tipo_operacion_id);
  const selectedTipoOperacion =
    tiposOperacion.find((tipo) => resolveNumericId(tipo?.id) === currentTipoOperacionId) ??
    record?.tipo_operacion;
  const isAlquiler = isTipoOperacionAlquiler(selectedTipoOperacion);
  const tipoActualizacionId =
    resolveNumericId(tipoActualizacionValue) ?? resolveNumericId(record?.tipo_actualizacion_id);
  const { data: tipoActualizacion } = useGetOne(
    "tipos-actualizacion",
    { id: tipoActualizacionId ?? 0 },
    { enabled: Boolean(tipoActualizacionId) && isAlquiler },
  );

  if (!isAlquiler) return null;

  const tipoActualizacionLabel =
    (tipoActualizacion as { nombre?: string | null } | undefined)?.nombre ??
    record?.tipo_actualizacion?.nombre ??
    "Sin asignar";
  const fechaRenovacion = fechaRenovacionValue ?? record?.fecha_renovacion ?? null;

  return (
    <div className="grid gap-2 md:grid-cols-[160px_minmax(0,220px)]">
      <FormValue
        label="Fecha renovacion"
        widthClass="w-full"
        valueClassName="justify-start text-left"
      >
        {formatPropiedadDisplayDate(fechaRenovacion)}
      </FormValue>
      <FormValue
        label="Tipo actualizacion"
        widthClass="w-full"
        valueClassName="justify-start text-left"
      >
        {tipoActualizacionLabel}
      </FormValue>
    </div>
  );
};

const CabeceraFields = () => (
  <div className="grid gap-2">
    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_140px_minmax(0,1fr)]">
      <FormText source="nombre" label="Nombre" validate={required()} widthClass="w-full md:max-w-[260px]" />
      <div className="md:w-[150px] md:min-w-[150px] md:max-w-[150px]">
        <ReferenceInput source="tipo_propiedad_id" reference="tipos-propiedad" label="Tipo propiedad">
          <FormSelect optionText="nombre" label="Tipo propiedad" widthClass="w-full" emptyText="Sin asignar" />
        </ReferenceInput>
      </div>
      <div className="md:w-[140px] md:min-w-[140px] md:max-w-[140px]">
        <ReferenceInput
          source="tipo_operacion_id"
          reference="crm/catalogos/tipos-operacion"
          label="Tipo de operacion"
        >
          <FormSelect
            optionText="nombre"
            label="Tipo de operacion"
            widthClass="w-full"
            emptyText="Sin asignar"
            choicesFilter={excludeMantenimientoTipoOperacion}
          />
        </ReferenceInput>
      </div>
      <ReferenceInput source="propietario_id" reference="propietarios" label="Propietario">
        <FormSelect optionText="nombre" label="Propietario" widthClass="w-full" emptyText="Sin asignar" />
      </ReferenceInput>
    </div>
    <CabeceraContratoResumen />
  </div>
);

const useNombreUnicoFormValidator = () => {
  const dataProvider = useDataProvider();
  const record = useRecordContext<Propiedad>();

  return async (values: PropiedadFormValues) => {
    const normalized = String(values?.nombre ?? "").trim();
    if (!normalized) return {};
    const currentNombre = String(record?.nombre ?? "").trim();
    if (currentNombre && currentNombre.toLowerCase() === normalized.toLowerCase()) {
      return {};
    }
    try {
      const result = await dataProvider.getList<Propiedad>("propiedades", {
        filter: { nombre__eq: normalized },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "DESC" },
      });
      const exists = (result.data ?? []).some(
        (item) =>
          String(item?.nombre ?? "").trim().toLowerCase() === normalized.toLowerCase() &&
          item.id !== record?.id,
      );
      return exists ? { nombre: "Ya existe una propiedad con ese nombre" } : {};
    } catch {
      return {};
    }
  };
};

const CabeceraOpcionales = () => (
  <div className="mt-1 space-y-0">
    <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
      <div className="grid gap-2 md:grid-cols-4">
        <FormTextarea
          source="estado_comentario"
          label="Comentario"
          widthClass="w-full"
          className="md:col-span-4 [&_textarea]:min-h-[64px]"
        />
      </div>
    </div>
  </div>
);

const FichaFields = () => (
  <div className="grid gap-2 md:grid-cols-4">
    <ReferenceInput source="emprendimiento_id" reference="emprendimientos" label="Emprendimiento">
      <FormSelect optionText="nombre" label="Emprendimiento" widthClass="w-full" emptyText="Sin asignar" />
    </ReferenceInput>
    <ReferenceInput source="contacto_id" reference="crm/contactos" label="Contacto propietario">
      <FormSelect
        optionText="nombre_completo"
        label="Contacto propietario"
        widthClass="w-full"
        emptyText="Sin asignar"
      />
    </ReferenceInput>
    <FormNumber source="ambientes" label="Ambientes" min={0} widthClass="w-full" />
    <FormNumber
      source="metros_cuadrados"
      label="Metros cuadrados"
      min={0}
      step={0.1}
      widthClass="w-full"
    />
    <FormNumber source="costo_propiedad" label="Costo" step="any" min={0} widthClass="w-full" />
    <ReferenceInput source="costo_moneda_id" reference="monedas" label="Moneda">
      <FormSelect optionText="nombre" label="Moneda" widthClass="w-full" emptyText="Sin asignar" />
    </ReferenceInput>
  </div>
);

const FichaSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  if (variant === "panel") {
    return (
      <PropiedadDesktopPanel
        title="Ficha"
        description="Datos descriptivos y economicos de la propiedad."
      >
        <FichaFields />
      </PropiedadDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title="Ficha"
      main={<FichaFields />}
      defaultOpen={false}
    />
  );
};

const DireccionFields = () => (
  <div className="grid gap-2 md:grid-cols-3">
    <FormText
      source="domicilio"
      label="Domicilio"
      widthClass="w-full md:col-span-3"
      maxLength={500}
    />
    <FormText source="localidad" label="Localidad" widthClass="w-full" maxLength={200} />
    <FormText source="provincia" label="Provincia" widthClass="w-full" maxLength={100} />
    <FormText source="codigo_postal" label="Codigo postal" widthClass="w-full" maxLength={20} />
    <FormText
      source="matricula_catastral"
      label="Matricula catastral"
      widthClass="w-full md:col-span-2"
      maxLength={200}
    />
    <FormText
      source="padron"
      label="Padron"
      widthClass="w-full md:col-span-2"
      maxLength={200}
    />
  </div>
);

const DireccionSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  if (variant === "panel") {
    return (
      <PropiedadDesktopPanel
        title="Direccion"
        description="Datos de ubicacion del inmueble utilizados en contratos."
      >
        <DireccionFields />
      </PropiedadDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title="Direccion"
      main={<DireccionFields />}
      defaultOpen={false}
    />
  );
};

const formatPropiedadDisplayDate = (value?: string | null) => {
  if (!value) return "Sin fecha";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-AR");
};

type ContratosListSectionProps = {
  title: string;
  propiedadId?: number;
  persistKey: string;
  storeKey: string;
  variant?: PropiedadSectionVariant;
};

const ContratosListSection = ({
  title,
  propiedadId,
  persistKey,
  storeKey,
  variant = "stacked",
}: ContratosListSectionProps) => {
  const location = useLocation();
  const resolvedPropiedadId = propiedadId ?? null;
  const returnTo = `${location.pathname}${location.search}`;

  const createTo = useMemo(() => {
    const params = new URLSearchParams();
    if (resolvedPropiedadId) {
      params.set("propiedad_id", String(resolvedPropiedadId));
    }
    params.set("returnTo", returnTo);
    return `/contratos/create?${params.toString()}`;
  }, [resolvedPropiedadId, returnTo]);

  const defaultFilters = useMemo(
    () => ({ propiedad_id: resolvedPropiedadId }),
    [resolvedPropiedadId],
  );
  const permanentFilter = useMemo(
    () => ({ propiedad_id: resolvedPropiedadId }),
    [resolvedPropiedadId],
  );
  const rowClick = useMemo(
    () =>
      (id: string | number) =>
        `/contratos/${id}?returnTo=${encodeURIComponent(returnTo)}`,
    [returnTo],
  );

  if (!resolvedPropiedadId) {
    const placeholder = (
      <PropiedadDesktopEmptyState message={`Los ${title.toLowerCase()} estaran disponibles despues de guardar la propiedad.`} />
    );

    if (variant === "panel") {
      return (
        <PropiedadDesktopPanel
          title={title}
          description={`Documentacion contractual e historico asociado a la propiedad para ${title.toLowerCase()}.`}
        >
          {placeholder}
        </PropiedadDesktopPanel>
      );
    }

    return null;
  }

  const list = (
    <ContratoList
      embedded
      filterDefaultValues={defaultFilters}
      permanentFilter={permanentFilter}
      createTo={createTo}
      rowClick={rowClick}
      storeKey={storeKey}
      emptyMessage={`No hay ${title.toLowerCase()} registrados para esta propiedad.`}
    />
  );

  if (variant === "panel") {
    return (
      <PropiedadDesktopPanel
        title={title}
        description={`Documentacion contractual e historico asociado a la propiedad para ${title.toLowerCase()}.`}
      >
        {list}
      </PropiedadDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title={title}
      defaultOpen={false}
      persistKey={persistKey}
      main={list}
    />
  );
};

const DatosContratoSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  return (
    <ContratosListSection
      title="Contratos"
      propiedadId={propiedadId}
      persistKey={`propiedades-contratos-${propiedadId ?? "sin-propiedad"}`}
      storeKey={`contratos-propiedad-${propiedadId ?? "sin-propiedad"}`}
      variant={variant}
    />
  );
};

const EstadosListContent = () => (
  <ResponsiveDataTable
    rowClick={false}
    mobileConfig={{
      primaryField: "estado_nuevo",
      secondaryFields: ["fecha_cambio", "usuario_id", "motivo"],
    }}
    className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px] [&_tbody_td]:align-top"
  >
    <ListColumn source="estado_anterior" label="Estado anterior" className="w-[92px]">
      <ListText source="estado_anterior" />
    </ListColumn>
    <ListColumn source="estado_nuevo" label="Estado nuevo" className="w-[92px]">
      <ListText source="estado_nuevo" />
    </ListColumn>
    <ListColumn source="fecha_cambio" label="Fecha" className="w-[84px]">
      <ListDate source="fecha_cambio" />
    </ListColumn>
    <ListColumn source="usuario_id" label="Usuario" className="w-[96px]">
      <ReferenceField source="usuario_id" reference="users" link={false}>
        <ListText source="nombre" className="whitespace-normal break-words" />
      </ReferenceField>
    </ListColumn>
    <ListColumn source="motivo" label="Motivo" className="w-[220px]">
      <ListText source="motivo" className="whitespace-normal break-words" />
    </ListColumn>
  </ResponsiveDataTable>
);

const EstadosSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = resolveNumericId(record?.id);

  if (!propiedadId) {
    const placeholder = (
      <PropiedadDesktopEmptyState message="El historial de estados estara disponible despues de guardar la propiedad." />
    );

    if (variant === "panel") {
      return (
        <PropiedadDesktopPanel
          title="Estados"
          description="Historial de cambios de estado de la propiedad, ordenado del mas reciente al mas antiguo."
        >
          {placeholder}
        </PropiedadDesktopPanel>
      );
    }

    return (
      <SectionBaseTemplate
        title="Estados"
        main={placeholder}
        defaultOpen={false}
        persistKey="propiedades-estados-sin-propiedad"
      />
    );
  }

  const list = (
    <ListBase
      resource="propiedades-log-status"
      perPage={10}
      sort={{ field: "fecha_cambio", order: "DESC" }}
      filterDefaultValues={{ propiedad_id: propiedadId }}
      disableSyncWithLocation
      storeKey={`propiedades-log-status-${propiedadId}`}
    >
      <EstadosListContent />
    </ListBase>
  );

  if (variant === "panel") {
    return (
      <PropiedadDesktopPanel
        title="Estados"
        description="Historial de cambios de estado de la propiedad, ordenado del mas reciente al mas antiguo."
      >
        {list}
      </PropiedadDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title="Estados"
      main={list}
      defaultOpen={false}
      persistKey={`propiedades-estados-${propiedadId}`}
    />
  );
};

const OportunidadesSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  const tipoOperacionId = record?.tipo_operacion_id ?? null;

  return (
    <OportunidadesListSection
      title="Oportunidades"
      propiedadId={propiedadId}
      tipoOperacionId={tipoOperacionId}
      persistKey={`propiedades-oportunidades-${propiedadId ?? "sin-propiedad"}`}
      storeKey={`crm-oportunidades-propiedad-${propiedadId ?? "sin-propiedad"}-tipo-${tipoOperacionId ?? "sin-tipo"}-v2`}
      variant={variant}
    />
  );
};

const useMantenimientoTipoOperacionId = () => {
  const tiposOperacion = useTiposOperacionCatalog();

  return useMemo(() => {
    const mantenimiento = (tiposOperacion ?? []).find((tipo: any) => isTipoOperacionMantenimiento(tipo));
    return (mantenimiento?.id as number | undefined) ?? null;
  }, [tiposOperacion]);
};

const useLatestMantenimientoOportunidad = (propiedadId?: number) => {
  const tipoOperacionId = useMantenimientoTipoOperacionId();
  const enabled = Boolean(propiedadId && tipoOperacionId);
  const { data: oportunidades = [], isPending } = useGetList<any>(
    "crm/oportunidades",
    {
      filter: {
        propiedad_id: propiedadId,
        tipo_operacion_id: tipoOperacionId,
        activo: true,
      },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled },
  );

  const oportunidad = oportunidades[0] as
    | { id?: unknown; contacto_id?: unknown }
    | undefined;

  return {
    tipoOperacionId,
    oportunidadId: resolveNumericId(oportunidad?.id),
    contactoId: resolveNumericId(oportunidad?.contacto_id),
    isLoading: Boolean(propiedadId) && (Boolean(!tipoOperacionId) || (enabled && isPending)),
  };
};

const useAvailablePropiedadSections = () => {
  const record = useRecordContext<Propiedad>();
  const tiposOperacion = useTiposOperacionCatalog();
  const tipoOperacionValue = useWatch({ name: "tipo_operacion_id" }) as unknown;
  const propiedadId = resolveNumericId(record?.id);
  const currentTipoOperacionId =
    resolveNumericId(tipoOperacionValue) ?? resolveNumericId(record?.tipo_operacion_id);
  const selectedTipoOperacion = useMemo(
    () =>
      tiposOperacion.find((tipo) => resolveNumericId(tipo?.id) === currentTipoOperacionId),
    [currentTipoOperacionId, tiposOperacion],
  );
  const isAlquiler = isTipoOperacionAlquiler(selectedTipoOperacion);
  useLatestMantenimientoOportunidad(propiedadId);

  return useMemo(() => {
    const visibleIds: PropiedadDesktopSectionId[] = ["ficha", "direccion", "estados"];

    if (isAlquiler) {
      visibleIds.push("contrato");
    }

    visibleIds.push("oportunidades", "reparaciones", "servicios");

    return PROPIEDAD_DESKTOP_SECTIONS.filter((section) => visibleIds.includes(section.id));
  }, [isAlquiler]);
};

const ServiciosSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  const location = useLocation();
  const resolvedPropiedadId = propiedadId ?? null;
  const returnTo = `${location.pathname}${location.search}`;

  const createTo = useMemo(() => {
    const params = new URLSearchParams();
    if (resolvedPropiedadId) {
      params.set("propiedad_id", String(resolvedPropiedadId));
      params.set("lock_propiedad", "1");
    }
    params.set("returnTo", returnTo);
    return `/propiedades-servicios/create?${params.toString()}`;
  }, [resolvedPropiedadId, returnTo]);

  if (!resolvedPropiedadId) {
    const placeholder = (
      <PropiedadDesktopEmptyState message="Los servicios estaran disponibles despues de guardar la propiedad." />
    );

    if (variant === "panel") {
      return (
        <PropiedadDesktopPanel
          title="Servicios"
          description="Servicios vinculados a la propiedad."
        >
          {placeholder}
        </PropiedadDesktopPanel>
      );
    }

    return (
      <SectionBaseTemplate
        title="Servicios"
        main={placeholder}
        defaultOpen={false}
        persistKey="propiedades-servicios-sin-propiedad"
      />
    );
  }

  const defaultFilters = { propiedad_id: resolvedPropiedadId };
  const permanentFilter = { propiedad_id: resolvedPropiedadId };
  const storeKey = `propiedades-servicios-propiedad-${resolvedPropiedadId}`;
  const rowClick = useMemo(
    () =>
      (id: string | number) =>
        `/propiedades-servicios/${id}?returnTo=${encodeURIComponent(returnTo)}`,
    [returnTo],
  );

  const list = (
    <PropiedadServicioList
      key={storeKey}
      embedded
      filterDefaultValues={defaultFilters}
      permanentFilter={permanentFilter}
      createTo={createTo}
      rowClick={rowClick}
      storeKey={storeKey}
    />
  );

  if (variant === "panel") {
    return (
      <PropiedadDesktopPanel
        title="Servicios"
        description="Servicios vinculados a la propiedad."
      >
        {list}
      </PropiedadDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title="Servicios"
      defaultOpen={false}
      persistKey={`propiedades-servicios-${resolvedPropiedadId}`}
      main={list}
    />
  );
};

const ReparacionesSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  const tipoOperacionId = useMantenimientoTipoOperacionId();

  return (
    <OportunidadesListSection
      title="Reparaciones"
      propiedadId={propiedadId}
      tipoOperacionId={tipoOperacionId}
      persistKey={`propiedades-reparaciones-${propiedadId ?? "sin-propiedad"}`}
      storeKey={`crm-oportunidades-reparaciones-${propiedadId ?? "sin-propiedad"}-tipo-${tipoOperacionId ?? "sin-tipo"}-v2`}
      variant={variant}
      waitForTipoOperacion
    />
  );
};

const PropiedadChatSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  const { oportunidadId, isLoading } = useLatestMantenimientoOportunidad(propiedadId);

  let content: ReactNode;
  if (!propiedadId) {
    content = (
      <PropiedadDesktopEmptyState message="El chat estara disponible despues de guardar la propiedad." />
    );
  } else if (isLoading) {
    content = (
      <PropiedadDesktopEmptyState message="Cargando la ultima oportunidad de mantenimiento..." />
    );
  } else if (!oportunidadId) {
    content = (
      <PropiedadDesktopEmptyState message="El chat estara disponible cuando exista una oportunidad de mantenimiento para esta propiedad." />
    );
  } else {
    content = <CRMChatShow forcedId={`op-${oportunidadId}`} embedded />;
  }

  if (variant === "panel") {
    return (
      <PropiedadDesktopPanel
        title="Chat"
        description="Conversacion y seguimiento contextual vinculado a la ultima oportunidad de mantenimiento."
      >
        {content}
      </PropiedadDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title="Chat"
      defaultOpen={false}
      persistKey={`propiedades-chat-mantenimiento-${propiedadId ?? "sin-propiedad"}`}
      main={content}
    />
  );
};

const PropiedadEventosSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  const location = useLocation();
  const navigate = useNavigate();
  const { oportunidadId, contactoId, isLoading } = useLatestMantenimientoOportunidad(propiedadId);
  const returnTo = `${location.pathname}${location.search}`;

  const createTo = useMemo(() => {
    if (!oportunidadId) return "";
    const params = new URLSearchParams();
    appendFilterParam(
      params,
      buildOportunidadFilter(
        oportunidadId,
        contactoId ? { contacto_id: contactoId } : undefined,
      ),
    );
    params.set("returnTo", returnTo);
    return `/crm/crm-eventos/create?${params.toString()}`;
  }, [contactoId, oportunidadId, returnTo]);

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

  const placeholder = !propiedadId ? (
    <PropiedadDesktopEmptyState message="Los eventos estaran disponibles despues de guardar la propiedad." />
  ) : isLoading ? (
    <PropiedadDesktopEmptyState message="Cargando la ultima oportunidad de mantenimiento..." />
  ) : !oportunidadId ? (
    <PropiedadDesktopEmptyState message="Los eventos estaran disponibles cuando exista una oportunidad de mantenimiento para esta propiedad." />
  ) : null;

  if (placeholder) {
    if (variant === "panel") {
      return (
        <PropiedadDesktopPanel
          title="Eventos"
          description="Agenda comercial y operativa asociada a la ultima oportunidad de mantenimiento."
        >
          {placeholder}
        </PropiedadDesktopPanel>
      );
    }

    return (
      <SectionBaseTemplate
        title="Eventos"
        defaultOpen={false}
        persistKey={`propiedades-eventos-mantenimiento-${propiedadId ?? "sin-propiedad"}`}
        main={placeholder}
      />
    );
  }

  if (variant === "panel") {
    return (
      <PropiedadDesktopPanel
        title="Eventos"
        description="Agenda comercial y operativa asociada a la ultima oportunidad de mantenimiento."
        actions={<CreateButton to={createTo} label="Agregar evento" />}
      >
        <ListBase
          resource="crm/crm-eventos"
          perPage={200}
          sort={{ field: "fecha_evento", order: "DESC" }}
          filterDefaultValues={defaultFilters}
          disableSyncWithLocation
          storeKey={`crm-eventos-propiedad-mantenimiento-${oportunidadId}`}
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
        </ListBase>
      </PropiedadDesktopPanel>
    );
  }

  return (
    <ListBase
      resource="crm/crm-eventos"
      perPage={200}
      sort={{ field: "fecha_evento", order: "DESC" }}
      filterDefaultValues={defaultFilters}
      disableSyncWithLocation
      storeKey={`crm-eventos-propiedad-mantenimiento-${oportunidadId}`}
    >
      <SectionBaseTemplate
        title="Eventos"
        defaultOpen={false}
        persistKey={`propiedades-eventos-mantenimiento-${propiedadId}`}
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
    </ListBase>
  );
};

const PropiedadOrdenesSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  const location = useLocation();
  const { oportunidadId, isLoading } = useLatestMantenimientoOportunidad(propiedadId);

  const createTo = useMemo(() => {
    if (!oportunidadId) return "";
    const params = new URLSearchParams();
    params.set("oportunidad_id", String(oportunidadId));
    params.set("lock_oportunidad", "1");
    params.set("lock_centro", "1");
    params.set("returnTo", `${location.pathname}${location.search}`);
    return `/po-orders/create?${params.toString()}`;
  }, [location.pathname, location.search, oportunidadId]);

  const defaultFilters = useMemo(
    () => (oportunidadId ? { oportunidad_id: oportunidadId } : undefined),
    [oportunidadId],
  );

  let content: ReactNode;
  if (!propiedadId) {
    content = (
      <PropiedadDesktopEmptyState message="Las ordenes estaran disponibles despues de guardar la propiedad." />
    );
  } else if (isLoading) {
    content = (
      <PropiedadDesktopEmptyState message="Cargando la ultima oportunidad de mantenimiento..." />
    );
  } else if (!oportunidadId) {
    content = (
      <PropiedadDesktopEmptyState message="Las ordenes estaran disponibles cuando exista una oportunidad de mantenimiento para esta propiedad." />
    );
  } else {
    content = (
      <PoOrderList
        embedded
        filterDefaultValues={defaultFilters}
        createTo={createTo}
        storeKey={`po-orders-propiedad-mantenimiento-${oportunidadId}`}
      />
    );
  }

  if (variant === "panel") {
    return (
      <PropiedadDesktopPanel
        title="Ordenes"
        description="Ordenes de compra vinculadas a la ultima oportunidad de mantenimiento."
      >
        {content}
      </PropiedadDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title="Ordenes"
      defaultOpen={false}
      persistKey={`propiedades-ordenes-mantenimiento-${propiedadId ?? "sin-propiedad"}`}
      main={content}
    />
  );
};

type OportunidadesListSectionProps = {
  title: string;
  propiedadId?: number;
  tipoOperacionId: number | null;
  persistKey: string;
  storeKey: string;
  variant?: PropiedadSectionVariant;
  waitForTipoOperacion?: boolean;
};

const OportunidadesListSection = ({
  title,
  propiedadId,
  tipoOperacionId,
  persistKey,
  storeKey,
  variant = "stacked",
  waitForTipoOperacion = false,
}: OportunidadesListSectionProps) => {
  const location = useLocation();
  const resolvedPropiedadId = propiedadId ?? null;
  const returnTo = `${location.pathname}${location.search}`;

  const createTo = useMemo(() => {
    const basePath = "/crm/oportunidades/create";
    const params = new URLSearchParams();
    if (resolvedPropiedadId) {
      params.set("propiedad_id", String(resolvedPropiedadId));
    }
    if (tipoOperacionId) {
      params.set("tipo_operacion_id", String(tipoOperacionId));
    }
    params.set("returnTo", returnTo);
    return `${basePath}?${params.toString()}`;
  }, [resolvedPropiedadId, returnTo, tipoOperacionId]);

  const defaultFilters = useMemo(
    () => ({
      propiedad_id: resolvedPropiedadId,
      tipo_operacion_id: tipoOperacionId ?? null,
    }),
    [resolvedPropiedadId, tipoOperacionId],
  );
  const permanentFilter = useMemo(
    () => ({
      propiedad_id: resolvedPropiedadId,
      ...(tipoOperacionId ? { tipo_operacion_id: tipoOperacionId } : {}),
    }),
    [resolvedPropiedadId, tipoOperacionId],
  );

  if (!resolvedPropiedadId) {
    const placeholder = (
      <PropiedadDesktopEmptyState message={`Las ${title.toLowerCase()} estaran disponibles despues de guardar la propiedad.`} />
    );

    if (variant === "panel") {
      return (
        <PropiedadDesktopPanel
          title={title}
          description={`Seguimiento comercial y operativo asociado a la propiedad para ${title.toLowerCase()}.`}
        >
          {placeholder}
        </PropiedadDesktopPanel>
      );
    }

    return null;
  }

  if (waitForTipoOperacion && !tipoOperacionId) {
    const placeholder = (
      <PropiedadDesktopEmptyState message={`Cargando el tipo de operacion para ${title.toLowerCase()}...`} />
    );

    if (variant === "panel") {
      return (
        <PropiedadDesktopPanel
          title={title}
          description={`Seguimiento comercial y operativo asociado a la propiedad para ${title.toLowerCase()}.`}
        >
          {placeholder}
        </PropiedadDesktopPanel>
      );
    }

    return (
      <SectionBaseTemplate
        title={title}
        defaultOpen={false}
        persistKey={persistKey}
        main={placeholder}
      />
    );
  }

  const list = (
    <CRMOportunidadList
      key={storeKey}
      embedded
      compact
      showBulkActions={false}
      filterDefaultValues={defaultFilters}
      permanentFilter={permanentFilter}
      createTo={createTo}
      storeKey={storeKey}
      emptyMessage={`No hay ${title.toLowerCase()} registradas para esta propiedad.`}
    />
  );

  if (variant === "panel") {
    return (
      <PropiedadDesktopPanel
        title={title}
        description={`Seguimiento comercial y operativo asociado a la propiedad para ${title.toLowerCase()}.`}
      >
        {list}
      </PropiedadDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title={title}
      defaultOpen={false}
      persistKey={persistKey}
      main={list}
    />
  );
};

const PropiedadDesktopSectionsLayout = ({
  activeSection,
  availableSections,
  onSectionChange,
}: {
  activeSection: PropiedadDesktopSectionId;
  availableSections: Array<{ id: PropiedadDesktopSectionId; label: string }>;
  onSectionChange: (sectionId: PropiedadDesktopSectionId) => void;
}) => {
  const activeConfig =
    availableSections.find((section) => section.id === activeSection) ??
    availableSections[0];

  const renderActiveSection = () => {
    switch (activeSection) {
      case "ficha":
        return <FichaSection variant="panel" />;
      case "direccion":
        return <DireccionSection variant="panel" />;
      case "contrato":
        return <DatosContratoSection variant="panel" />;
      case "estados":
        return <EstadosSection variant="panel" />;
      case "oportunidades":
        return <OportunidadesSection variant="panel" />;
      case "reparaciones":
        return <ReparacionesSection variant="panel" />;
      case "servicios":
        return <ServiciosSection variant="panel" />;
      case "ordenes":
        return <PropiedadOrdenesSection variant="panel" />;
      case "chat":
        return <PropiedadChatSection variant="panel" />;
      case "eventos":
        return <PropiedadEventosSection variant="panel" />;
      default:
        return null;
    }
  };

  return (
    <div className="hidden rounded-[28px] border border-border/60 bg-card/90 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] lg:grid lg:grid-cols-[98px_minmax(0,1fr)]">
      <aside className="border-r border-border/50 bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.96)_100%)] p-2">
        <div className="flex flex-col gap-1">
          {availableSections.map((section) => {
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
