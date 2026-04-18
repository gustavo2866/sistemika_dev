"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  required,
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRecordContext,
} from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, MoreHorizontal, Plus, UserRound } from "lucide-react";
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
  resolveNumericId,
  RowActionDialogProvider,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { CreateButton } from "@/components/create-button";
import { CRMOportunidadList } from "@/app/resources/crm/crm-oportunidades/List";
import { ContratoList } from "@/app/resources/inmobiliaria/contratos/list";
import { PoOrderList } from "@/app/resources/po/po-orders/List";
import {
  PropiedadServicioList,
  PropiedadServiciosAccionesMenu,
} from "@/app/resources/inmobiliaria/propiedades-servicios";
import { ReferenceInput } from "@/components/reference-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  type PropiedadDesktopSectionId,
  type Propiedad,
  type PropiedadFormValues,
  excludeMantenimientoTipoOperacion,
  getVisiblePropiedadSectionIds,
  isTipoOperacionAlquiler,
} from "./model";
import { CabeceraActionsMenu } from "./cabecera_actions_menu";
import { PROPIEDAD_DIALOG_OVERLAY_CLASS } from "./dialog_styles";
import {
  useDefaultTipoOperacionId,
  useMantenimientoOportunidadesActivas,
  useMantenimientoTipoOperacionId,
  useTiposOperacionCatalog,
} from "./form_hooks";
import {
  PropiedadRelatedCreateProvider,
  usePropiedadRelatedCreate,
} from "./related_create";

const DESKTOP_LAYOUT_BREAKPOINT = 1024;
const PROPIEDAD_ACTIVE_SECTION_STORAGE_KEY_PREFIX = "propiedades-form-active-section";

type PropiedadSectionVariant = "stacked" | "panel";

const PROPIEDAD_DESKTOP_SECTIONS: Array<{
  id: PropiedadDesktopSectionId;
  label: string;
}> = [
  { id: "ficha", label: "Ficha" },
  { id: "servicios", label: "Servicios" },
  { id: "contrato", label: "Contrato" },
  { id: "reparaciones", label: "Reparaciones" },
  { id: "ordenes", label: "Ordenes" },
];

const isPropiedadDesktopSectionId = (
  value: unknown,
): value is PropiedadDesktopSectionId =>
  PROPIEDAD_DESKTOP_SECTIONS.some((section) => section.id === value);

const getStoredPropiedadSection = (storageKey: string) => {
  if (typeof window === "undefined") return null;
  const savedValue = window.sessionStorage.getItem(storageKey);
  return isPropiedadDesktopSectionId(savedValue) ? savedValue : null;
};

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

const PropiedadStickyFooter = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("returnTo");
  }, [location.search]);

  const handleCancel = useCallback(() => {
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }
    navigate(-1);
  }, [navigate, returnTo]);

  return (
    <div className="sticky -bottom-6 z-20 mt-2 border-t border-border/60 bg-background/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="flex justify-end">
        <FormOrderToolbar
          className="shrink-0 justify-end flex-nowrap"
          saveProps={{ variant: "secondary" }}
          cancelProps={{ onClick: handleCancel }}
        />
      </div>
    </div>
  );
};

export const PropiedadForm = () => {
  return (
    <div
      id="propiedad-form-shell"
      className="relative w-full max-w-6xl"
    >
      <SimpleForm<PropiedadFormValues>
        className="w-full max-w-none max-h-[calc(100svh-10rem)] overflow-y-auto overscroll-y-contain pr-1 pb-4 sm:max-h-[calc(100svh-9rem)]"
        warnWhenUnsavedChanges
        validate={useNombreUnicoFormValidator() as any}
        toolbar={<PropiedadStickyFooter />}
      >
        <TipoOperacionDefaultSync />
        <CostoMonedaDefaultSync />
        <FormErrorSummary />
        <PropiedadRelatedCreateProvider>
          <RowActionDialogProvider>
            <PropiedadCabeceraSection />
          </RowActionDialogProvider>
          <PropiedadFormSectionsContent />
        </PropiedadRelatedCreateProvider>
      </SimpleForm>
    </div>
  );
};

const PropiedadCabeceraSection = () => {
  const { openDialog } = usePropiedadRelatedCreate();

  return (
    <SectionBaseTemplate
      title="Cabecera"
      main={<CabeceraFields />}
      optional={<CabeceraOpcionales />}
      actions={<CabeceraActionsMenu onOpenPropietario={() => openDialog("propietario")} />}
      defaultOpen
    />
  );
};

const PropiedadFormSectionsContent = () => {
  const location = useLocation();
  const isDesktopLayout = usePropiedadDesktopLayout();
  const availableSections = useAvailablePropiedadSections();
  const activeSectionStorageKey = `${PROPIEDAD_ACTIVE_SECTION_STORAGE_KEY_PREFIX}:${location.pathname}`;
  const [activeSection, setActiveSection] = useState<PropiedadDesktopSectionId>(() => {
    return getStoredPropiedadSection(activeSectionStorageKey) ?? "ficha";
  });

  useEffect(() => {
    setActiveSection(getStoredPropiedadSection(activeSectionStorageKey) ?? "ficha");
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
      <ServiciosSection />
      {availableSections.some((section) => section.id === "contrato") ? <DatosContratoSection /> : null}
      <ReparacionesSection />
      {availableSections.some((section) => section.id === "ordenes") ? <PropiedadOrdenesSection /> : null}
    </>
  );
};

const CabeceraContratoResumen = () => {
  const record = useRecordContext<Propiedad>();
  const tiposOperacion = useTiposOperacionCatalog();
  const tipoOperacionValue = useWatch({ name: "tipo_operacion_id" }) as unknown;
  const tipoActualizacionValue = useWatch({ name: "tipo_actualizacion_id" }) as unknown;
  const vencimientoContratoValue = useWatch({
    name: "vencimiento_contrato",
  }) as string | null | undefined;
  const fechaRenovacionValue = useWatch({ name: "fecha_renovacion" }) as string | null | undefined;
  const currentTipoOperacionId =
    resolveNumericId(tipoOperacionValue) ?? resolveNumericId(record?.tipo_operacion_id);
  const selectedTipoOperacion =
    tiposOperacion.find((tipo) => resolveNumericId(tipo?.id) === currentTipoOperacionId) ??
    record?.tipo_operacion;
  const isAlquiler = isTipoOperacionAlquiler(selectedTipoOperacion ?? undefined);
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
  const vencimientoContrato = vencimientoContratoValue ?? record?.vencimiento_contrato ?? null;
  const fechaRenovacion = fechaRenovacionValue ?? record?.fecha_renovacion ?? null;

  return (
    <div className="grid gap-2 md:grid-cols-[160px_minmax(0,220px)_160px]">
      <FormValue
        label="Fecha Vencimiento"
        widthClass="w-full"
        valueClassName="justify-start text-left"
      >
        {formatPropiedadDisplayDate(vencimientoContrato)}
      </FormValue>
      <FormValue
        label="Tipo actualizacion"
        widthClass="w-full"
        valueClassName="justify-start text-left"
      >
        {tipoActualizacionLabel}
      </FormValue>
      <FormValue
        label="Fecha Actualizacion"
        widthClass="w-full"
        valueClassName="justify-start text-left"
      >
        {formatPropiedadDisplayDate(fechaRenovacion)}
      </FormValue>
    </div>
  );
};

const CabeceraFields = () => {
  const { propietarioRefreshKey } = usePropiedadRelatedCreate();

  return (
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
        <ReferenceInput
          key={`propietario-${propietarioRefreshKey}`}
          source="propietario_id"
          reference="propietarios"
          label="Propietario"
        >
          <FormSelect
            optionText="nombre"
            label="Propietario"
            widthClass="w-full"
            emptyText="Sin asignar"
            validate={required()}
          />
        </ReferenceInput>
      </div>
      <CabeceraContratoResumen />
    </div>
  );
};

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
  <FichaFieldsContent />
);

const FichaFieldsContent = () => {
  const { contactoRefreshKey, emprendimientoRefreshKey } = usePropiedadRelatedCreate();

  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-4">
        <ReferenceInput
          key={`emprendimiento-${emprendimientoRefreshKey}`}
          source="emprendimiento_id"
          reference="emprendimientos"
          label="Emprendimiento"
        >
          <FormSelect optionText="nombre" label="Emprendimiento" widthClass="w-full" emptyText="Sin asignar" />
        </ReferenceInput>
        <ReferenceInput
          key={`contacto-${contactoRefreshKey}`}
          source="contacto_id"
          reference="crm/contactos"
          label="Contacto propietario"
        >
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
      <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Direccion
        </div>
        <DireccionFields />
      </div>
    </div>
  );
};

const FICHA_ACTION_ITEM_CLASSNAME = "gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]";
const FICHA_ACTION_ICON_CLASSNAME = "mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5";

const FichaActionsMenu = () => {
  const { openDialog } = usePropiedadRelatedCreate();

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            tabIndex={-1}
            aria-label="Acciones de ficha"
            title="Acciones de ficha"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className={FICHA_ACTION_ITEM_CLASSNAME}
            onSelect={(event) => {
              event.stopPropagation();
              openDialog("contacto");
            }}
          >
            <UserRound className={FICHA_ACTION_ICON_CLASSNAME} />
            Contacto +
          </DropdownMenuItem>
          <DropdownMenuItem
            className={FICHA_ACTION_ITEM_CLASSNAME}
            onSelect={(event) => {
              event.stopPropagation();
              openDialog("emprendimiento");
            }}
          >
            <Home className={FICHA_ACTION_ICON_CLASSNAME} />
            Emprendimiento +
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

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
        actions={<FichaActionsMenu />}
      >
        <FichaFields />
      </PropiedadDesktopPanel>
    );
  }

  return (
    <SectionBaseTemplate
      title="Ficha"
      main={<FichaFields />}
      actions={<FichaActionsMenu />}
      defaultOpen
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
  const navigate = useNavigate();
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
  const createAction = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs"
        onClick={() => {
          navigate(createTo);
        }}
      >
        <Plus />
        Crear
      </Button>
    ),
    [createTo, navigate],
  );

  if (!resolvedPropiedadId) {
    const placeholder = (
      <div className="min-h-[22rem] px-4 pt-1 pb-4 xl:px-6 xl:pt-1.5 xl:pb-5">
        <PropiedadDesktopEmptyState message={`Los ${title.toLowerCase()} estaran disponibles despues de guardar la propiedad.`} />
      </div>
    );
    return placeholder;
  }

  const list = (
    <div className="min-h-[22rem] px-4 pt-1 pb-4 xl:px-6 xl:pt-1.5 xl:pb-5">
      <ContratoList
        embedded
        showEmbeddedHeader
        embeddedTitle={
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            {title}
          </span>
        }
        filterDefaultValues={defaultFilters}
        permanentFilter={permanentFilter}
        createTo={createTo}
        createAction={createAction}
        rowClick={rowClick}
        storeKey={storeKey}
        emptyMessage={`No hay ${title.toLowerCase()} registrados para esta propiedad.`}
      />
    </div>
  );

  if (variant === "panel") {
    return list;
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

  return useMemo(() => {
    const visibleIds = getVisiblePropiedadSectionIds(isAlquiler);
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
  const rowClick = useMemo(
    () =>
      (id: string | number) =>
        `/propiedades-servicios/${id}?returnTo=${encodeURIComponent(returnTo)}`,
    [returnTo],
  );

  if (!resolvedPropiedadId) {
    const placeholder = (
      <div className="min-h-[22rem] px-4 pt-1 pb-4 xl:px-6 xl:pt-1.5 xl:pb-5">
        <PropiedadDesktopEmptyState message="Los servicios estaran disponibles despues de guardar la propiedad." />
      </div>
    );
    return placeholder;
  }

  const defaultFilters = { propiedad_id: resolvedPropiedadId };
  const permanentFilter = { propiedad_id: resolvedPropiedadId };
  const storeKey = `propiedades-servicios-propiedad-${resolvedPropiedadId}`;

  const list = (
    <div className="min-h-[22rem] px-4 pt-1 pb-4 xl:px-6 xl:pt-1.5 xl:pb-5">
      <PropiedadServicioList
        key={storeKey}
        embedded
        showEmbeddedHeader
        embeddedTitle={
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            Servicios
          </span>
        }
        embeddedExtraActions={
          <PropiedadServiciosAccionesMenu
            propiedadId={resolvedPropiedadId}
            overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
          />
        }
        filterDefaultValues={defaultFilters}
        permanentFilter={permanentFilter}
        createTo={createTo}
        rowClick={rowClick}
        storeKey={storeKey}
      />
    </div>
  );

  if (variant === "panel") {
    return <RowActionDialogProvider>{list}</RowActionDialogProvider>;
  }

  return (
    <SectionBaseTemplate
      title="Servicios"
      defaultOpen={false}
      persistKey={`propiedades-servicios-${resolvedPropiedadId ?? "sin-propiedad"}`}
      main={<RowActionDialogProvider>{list}</RowActionDialogProvider>}
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

const PropiedadOrdenesSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  const location = useLocation();
  const { oportunidades, isLoading } = useMantenimientoOportunidadesActivas(propiedadId);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const navigate = useNavigate();
  const notify = useNotify();
  const returnTo = `${location.pathname}${location.search}`;

  const buildCreatePath = useCallback((selectedOportunidadId: number) => {
    const params = new URLSearchParams();
    params.set("oportunidad_id", String(selectedOportunidadId));
    params.set("lock_oportunidad", "1");
    params.set("lock_centro", "1");
    params.set("returnTo", returnTo);
    return `/po-orders/create?${params.toString()}`;
  }, [returnTo]);

  const handleCreateOrder = useCallback(() => {
    if (isLoading) return;
    if (oportunidades.length === 0) {
      notify("No hay oportunidades de mantenimiento abiertas para esta propiedad", {
        type: "warning",
      });
      return;
    }
    if (oportunidades.length === 1) {
      const onlyId = resolveNumericId(oportunidades[0]?.id);
      if (!onlyId) return;
      navigate(buildCreatePath(onlyId));
      return;
    }
    setSelectorOpen(true);
  }, [buildCreatePath, isLoading, navigate, notify, oportunidades]);

  const defaultFilters = useMemo(
    () =>
      propiedadId
        ? {
            "oportunidad.propiedad_id": propiedadId,
          }
        : undefined,
    [propiedadId],
  );

  const createAction = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs"
        onClick={handleCreateOrder}
        disabled={!propiedadId || isLoading}
      >
        <Plus />
        Crear
      </Button>
    ),
    [handleCreateOrder, isLoading, propiedadId],
  );

  let content: ReactNode;
  if (!propiedadId) {
    content = (
      <div className="min-h-[22rem] px-4 py-4 xl:px-6 xl:py-5">
        <PropiedadDesktopEmptyState message="Las ordenes estaran disponibles despues de guardar la propiedad." />
      </div>
    );
  } else {
    content = (
      <div className="min-h-[22rem] px-4 pt-1 pb-4 xl:px-6 xl:pt-1.5 xl:pb-5">
        <PoOrderList
          embedded
          showEmbeddedHeader
          embeddedTitle={
            <span className="text-base font-semibold tracking-tight sm:text-lg">
              Ordenes
            </span>
          }
          filterDefaultValues={defaultFilters}
          createAction={createAction}
          storeKey={`po-orders-propiedad-${propiedadId}`}
        />
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <>
        {content}
        <SeleccionarOportunidadOrdenDialog
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          oportunidades={oportunidades}
          onSelect={(selectedOportunidadId) => navigate(buildCreatePath(selectedOportunidadId))}
        />
      </>
    );
  }

  return (
    <>
      <SectionBaseTemplate
        title="Ordenes"
        defaultOpen={false}
        persistKey={`propiedades-ordenes-${propiedadId ?? "sin-propiedad"}`}
        main={content}
      />
      <SeleccionarOportunidadOrdenDialog
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        oportunidades={oportunidades}
        onSelect={(selectedOportunidadId) => navigate(buildCreatePath(selectedOportunidadId))}
      />
    </>
  );
};

const formatOportunidadLabel = (oportunidad: {
  id?: unknown;
  titulo?: string | null;
  descripcion_estado?: string | null;
  contacto?: { nombre?: string | null } | null;
  created_at?: string | null;
}) => {
  const title =
    String(oportunidad.descripcion_estado ?? "").trim() ||
    String(oportunidad.titulo ?? "").trim() ||
    `Oportunidad #${resolveNumericId(oportunidad.id) ?? "s/n"}`;
  const contacto = String(oportunidad.contacto?.nombre ?? "").trim();
  const createdAt = String(oportunidad.created_at ?? "").trim();
  return { title, contacto, createdAt };
};

const SeleccionarOportunidadOrdenDialog = ({
  open,
  onOpenChange,
  oportunidades,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidades: Array<{
    id?: unknown;
    titulo?: string | null;
    descripcion_estado?: string | null;
    created_at?: string | null;
    contacto?: { nombre?: string | null } | null;
  }>;
  onSelect: (oportunidadId: number) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className="sm:max-w-md"
      overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
    >
      <DialogHeader className="gap-1">
        <DialogTitle className="text-base leading-none">Seleccionar reparacion</DialogTitle>
        <DialogDescription className="text-[11px] leading-tight sm:text-xs">
          Hay mas de una reparacion abierta. Elige una para la nueva orden.
        </DialogDescription>
      </DialogHeader>
      <div className="flex max-h-[42vh] flex-col gap-1.5 overflow-y-auto pr-1">
        {oportunidades.map((oportunidad) => {
          const oportunidadId = resolveNumericId(oportunidad.id);
          if (!oportunidadId) return null;
          const { title, contacto, createdAt } = formatOportunidadLabel(oportunidad);

          return (
            <button
              key={oportunidadId}
              type="button"
              className="rounded-lg border border-border/70 px-2.5 py-1.5 text-left transition hover:border-primary/40 hover:bg-muted/40"
              onClick={() => {
                onOpenChange(false);
                onSelect(oportunidadId);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium leading-tight text-foreground">
                    {title}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                    {contacto || "Sin contacto"}
                  </div>
                </div>
                <div className="shrink-0 text-[10px] leading-none text-muted-foreground">
                  #{oportunidadId}
                </div>
              </div>
              <div className="mt-1 text-[10px] leading-none text-muted-foreground/90">
                {createdAt ? `Creada: ${createdAt}` : "Sin fecha"}
              </div>
            </button>
          );
        })}
      </div>
    </DialogContent>
  </Dialog>
);

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
      params.set("lock_propiedad", "1");
    }
    if (tipoOperacionId) {
      params.set("tipo_operacion_id", String(tipoOperacionId));
      params.set("lock_tipo_operacion", "1");
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

    return (
      <SectionBaseTemplate
        title={title}
        defaultOpen={false}
        persistKey={persistKey}
        main={placeholder}
      />
    );
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
    <div className="min-h-[22rem] px-4 pt-1 pb-4 xl:px-6 xl:pt-1.5 xl:pb-5">
      <CRMOportunidadList
        key={storeKey}
        embedded
        showEmbeddedHeader
        embeddedTitle={
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            {title}
          </span>
        }
        compact
        showBulkActions={false}
        filterDefaultValues={defaultFilters}
        permanentFilter={permanentFilter}
        createTo={createTo}
        storeKey={storeKey}
        emptyMessage={`No hay ${title.toLowerCase()} registradas para esta propiedad.`}
      />
    </div>
  );

  if (variant === "panel") {
    return list;
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
      case "contrato":
        return <DatosContratoSection variant="panel" />;
      case "reparaciones":
        return <ReparacionesSection variant="panel" />;
      case "servicios":
        return <ServiciosSection variant="panel" />;
      case "ordenes":
        return <PropiedadOrdenesSection variant="panel" />;
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
