"use client";

import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import {
  required,
  useGetList,
  useGetOne,
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
  FormSectionEmptyState,
  FormSectionPanel,
  FormSectionsDesktopLayout,
  FormSectionsMobileAccordion,
  type FormSectionsDesktopLayoutItem,
  FormReferenceAutocomplete,
  FormSelect,
  FormSelectFijo,
  FormText,
  FormTextarea,
  FormValue,
  resolveNumericId,
  RowActionDialogProvider,
  SectionBaseTemplate,
  useMinWidth,
  usePersistedActiveSection,
} from "@/components/forms/form_order";
import { ContratoList } from "@/app/resources/inmobiliaria/contratos/list";
import { PoOrderList } from "@/app/resources/po/po-orders";
import { OportunidadesList } from "@/app/resources/inmobiliaria/propiedades/oportunidades_list";
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
  Button,
} from "@/components/ui/button";
import { SeleccionarOportunidadOrdenDialog } from "./seleccionar_oportunidad_orden_dialog";
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
  useMantenimientoTipoOperacionId,
  useNombreUnicoFormValidator,
  usePropiedadOrdenesFlow,
  useTiposOperacionCatalog,
} from "./form_hooks";
import {
  PropiedadRelatedCreateProvider,
  usePropiedadRelatedCreate,
} from "./related_create";

const DESKTOP_LAYOUT_BREAKPOINT = 1024;
const PROPIEDAD_ACTIVE_SECTION_STORAGE_KEY_PREFIX = "propiedades-form-active-section";

type PropiedadSectionVariant = "stacked" | "panel" | "accordion";

type PropiedadSectionDefinition = FormSectionsDesktopLayoutItem<PropiedadDesktopSectionId> & {
  render: (variant?: PropiedadSectionVariant) => ReactNode;
};

// #region Layout y composicion general
const PROPIEDAD_EMBEDDED_SECTION_CONTENT_CLASSNAME =
  "min-h-[22rem] px-4 pt-1 pb-4 xl:px-6 xl:pt-1.5 xl:pb-5";
const PROPIEDAD_FORM_SELECT_TRIGGER_CLASSNAME =
  "w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate";

// Renderiza una seccion segun el modo visual activo del formulario.
const renderPropiedadSectionVariant = ({
  variant,
  title,
  description,
  actions,
  accordionActions,
  persistKey,
  defaultOpen = false,
  panelMode = "plain",
  children,
}: {
  variant: PropiedadSectionVariant;
  title: string;
  description?: string;
  actions?: ReactNode;
  accordionActions?: ReactNode;
  persistKey?: string;
  defaultOpen?: boolean;
  panelMode?: "plain" | "decorated";
  children: ReactNode;
}) => {
  if (variant === "panel") {
    if (panelMode === "plain") return children;

    return (
      <FormSectionPanel title={title} description={description} actions={actions}>
        {children}
      </FormSectionPanel>
    );
  }

  if (variant === "accordion") {
    if (!accordionActions) return children;

    return (
      <div className="space-y-2">
        <div className="flex justify-end">{accordionActions}</div>
        {children}
      </div>
    );
  }

  return (
    <SectionBaseTemplate
      title={title}
      main={children}
      actions={actions}
      defaultOpen={defaultOpen}
      persistKey={persistKey}
    />
  );
};

// Renderiza el titulo consistente de un listado embebido dentro de propiedades.
const PropiedadEmbeddedSectionTitle = ({ title }: { title: string }) => (
  <span className="text-base font-semibold tracking-tight sm:text-lg">{title}</span>
);

// Renderiza el cascaron visual comun de una seccion embebida del formulario.
const PropiedadEmbeddedSection = ({
  variant,
  title,
  persistKey,
  description,
  panelMode = "plain",
  isReady,
  emptyMessage,
  renderPlaceholderAsSection = true,
  contentClassName = PROPIEDAD_EMBEDDED_SECTION_CONTENT_CLASSNAME,
  emptyContentClassName,
  children,
}: {
  variant: PropiedadSectionVariant;
  title: string;
  persistKey: string;
  description?: string;
  panelMode?: "plain" | "decorated";
  isReady: boolean;
  emptyMessage: string;
  renderPlaceholderAsSection?: boolean;
  contentClassName?: string;
  emptyContentClassName?: string;
  children: ReactNode;
}) => {
  const content = isReady ? (
    <div className={contentClassName}>{children}</div>
  ) : (
    <div className={emptyContentClassName ?? contentClassName}>
      <FormSectionEmptyState message={emptyMessage} />
    </div>
  );

  if (!isReady && !renderPlaceholderAsSection) {
    return content;
  }

  return renderPropiedadSectionVariant({
    variant,
    title,
    description,
    persistKey,
    panelMode,
    children: content,
  });
};

// #endregion

// #region Defaults y sincronizacion de formulario
// Sincroniza el tipo de operacion inicial cuando el formulario se abre en alta.
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

// Sincroniza la moneda ARS por defecto al crear una nueva propiedad.
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

// #endregion

// #region Shell principal del formulario
// Renderiza la barra inferior fija con guardar y cancelar respetando returnTo.
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

// Renderiza el formulario principal de propiedades y monta sus providers locales.
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

// Renderiza la seccion Cabecera con sus campos principales y acciones.
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

// Renderiza el conjunto de secciones del formulario en desktop o mobile.
const PropiedadFormSectionsContent = () => {
  const location = useLocation();
  const isDesktopLayout = useMinWidth(DESKTOP_LAYOUT_BREAKPOINT);
  const availableSections = useAvailablePropiedadSections();
  const activeSectionStorageKey = `${PROPIEDAD_ACTIVE_SECTION_STORAGE_KEY_PREFIX}:${location.pathname}`;
  const [activeSection, setActiveSection] = usePersistedActiveSection<PropiedadDesktopSectionId>({
    storageKey: activeSectionStorageKey,
    sections: availableSections.map((section) => section.id),
    defaultSection: availableSections[0]?.id ?? "ficha",
  });

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
    <FormSectionsMobileAccordion<PropiedadDesktopSectionId, PropiedadSectionDefinition>
      sections={availableSections}
      defaultOpenSectionIds={[availableSections[0]?.id ?? "ficha"]}
      renderSection={(section) => section.render("accordion")}
    />
  );
};

// #endregion

// #region Cabecera
// Resume los datos contractuales visibles cuando la propiedad es de alquiler.
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

// Renderiza los campos principales de la cabecera del formulario.
const CabeceraFields = () => {
  const { propietarioRefreshKey } = usePropiedadRelatedCreate();

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_140px_minmax(0,1fr)]">
        <FormText source="nombre" label="Nombre" validate={required()} widthClass="w-full md:max-w-[260px]" />
        <div className="md:w-[150px] md:min-w-[150px] md:max-w-[150px]">
          <ReferenceInput source="tipo_propiedad_id" reference="tipos-propiedad" label="Tipo propiedad">
            <FormSelect
              optionText="nombre"
              label="Tipo propiedad"
              widthClass="w-full min-w-0"
              emptyText="Sin asignar"
              triggerProps={{ className: PROPIEDAD_FORM_SELECT_TRIGGER_CLASSNAME }}
            />
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
              widthClass="w-full min-w-0"
              emptyText="Sin asignar"
              choicesFilter={excludeMantenimientoTipoOperacion}
              validate={required()}
              triggerProps={{ className: PROPIEDAD_FORM_SELECT_TRIGGER_CLASSNAME }}
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
            widthClass="w-full min-w-0"
            emptyText="Sin asignar"
            validate={required()}
            triggerProps={{
              className: `${PROPIEDAD_FORM_SELECT_TRIGGER_CLASSNAME} justify-start text-left [&_[data-slot=select-value]]:text-left`,
            }}
          />
        </ReferenceInput>
      </div>
      <CabeceraContratoResumen />
    </div>
  );
};

// Renderiza los campos opcionales asociados al estado de la propiedad.
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

// #endregion

// #region Ficha
// Mantiene un punto unico de entrada para los campos de la ficha.
const FichaFields = () => (
  <FichaFieldsContent />
);

// Renderiza los campos descriptivos y economicos de la ficha.
const FichaFieldsContent = () => {
  const { contactoRefreshKey, emprendimientoRefreshKey } = usePropiedadRelatedCreate();

  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:items-start md:grid-cols-[minmax(0,1.2fr)_150px_110px_170px]">
        <ReferenceInput
          key={`emprendimiento-${emprendimientoRefreshKey}`}
          source="emprendimiento_id"
          reference="emprendimientos"
          label="Emprendimiento"
        >
          <FormSelect
            optionText="nombre"
            label="Emprendimiento"
            widthClass="w-full min-w-0"
            emptyText="Sin asignar"
            triggerProps={{ className: PROPIEDAD_FORM_SELECT_TRIGGER_CLASSNAME }}
          />
        </ReferenceInput>
        <ReferenceInput
          key={`contacto-${contactoRefreshKey}`}
          source="contacto_id"
          reference="crm/contactos"
          label="Contacto propietario"
        >
          <FormSelectFijo
            optionText="nombre_completo"
            label="Contacto propietario"
            widthClass="w-full min-w-0"
            emptyText="Sin asignar"
            fixedWidth="150px"
            triggerProps={{ className: PROPIEDAD_FORM_SELECT_TRIGGER_CLASSNAME }}
          />
        </ReferenceInput>
        <FormNumber source="ambientes" label="Ambientes" min={0} widthClass="w-full min-w-0" />
        <FormNumber
          source="metros_cuadrados"
          label="Metros cuadrados"
          min={0}
          step={0.1}
          widthClass="w-full min-w-0"
        />
        <FormNumber source="costo_propiedad" label="Costo" step="any" min={0} widthClass="w-full min-w-0" />
        <ReferenceInput source="costo_moneda_id" reference="monedas" label="Moneda">
          <FormSelect
            optionText="nombre"
            label="Moneda"
            widthClass="w-full min-w-0"
            emptyText="Sin asignar"
            triggerProps={{ className: PROPIEDAD_FORM_SELECT_TRIGGER_CLASSNAME }}
          />
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

// Muestra las acciones rapidas para crear entidades relacionadas desde la ficha.
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

// Renderiza la seccion Ficha respetando el layout activo del formulario.
const FichaSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) =>
  renderPropiedadSectionVariant({
    variant,
    title: "Ficha",
    description: "Datos descriptivos y economicos de la propiedad.",
    actions: <FichaActionsMenu />,
    accordionActions: <FichaActionsMenu />,
    defaultOpen: true,
    panelMode: "decorated",
    children: <FichaFields />,
  });

// Renderiza los campos de direccion y datos catastrales de la propiedad.
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

// Formatea fechas simples de propiedad para su visualizacion en UI.
const formatPropiedadDisplayDate = (value?: string | null) => {
  if (!value) return "Sin fecha";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-AR");
};

// #endregion

// #region Secciones externas
type ContratosListSectionProps = {
  title: string;
  propiedadId?: number;
  persistKey: string;
  storeKey: string;
  variant?: PropiedadSectionVariant;
};

// Inserta el listado de contratos relacionado a la propiedad actual.
const ContratosListSection = ({
  title,
  propiedadId,
  persistKey,
  storeKey,
  variant = "stacked",
}: ContratosListSectionProps) => {
  const resolvedPropiedadId = propiedadId ?? null;

  const defaultFilters = useMemo(
    () => ({ propiedad_id: resolvedPropiedadId }),
    [resolvedPropiedadId],
  );
  const permanentFilter = useMemo(
    () => ({ propiedad_id: resolvedPropiedadId }),
    [resolvedPropiedadId],
  );

  return (
    <PropiedadEmbeddedSection
      variant={variant}
      title={title}
      persistKey={persistKey}
      isReady={Boolean(resolvedPropiedadId)}
      emptyMessage={`Los ${title.toLowerCase()} estaran disponibles despues de guardar la propiedad.`}
    >
      <ContratoList
        embedded
        propiedadId={resolvedPropiedadId}
        showEmbeddedHeader
        embeddedTitle={<PropiedadEmbeddedSectionTitle title={title} />}
        filterDefaultValues={defaultFilters}
        permanentFilter={permanentFilter}
        storeKey={storeKey}
        emptyMessage={`No hay ${title.toLowerCase()} registrados para esta propiedad.`}
      />
    </PropiedadEmbeddedSection>
  );
};

// Adapta la seccion de contratos al contexto de la propiedad actual.
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

// Calcula las secciones visibles segun el tipo de operacion seleccionado.
const useAvailablePropiedadSections = () => {
  const record = useRecordContext<Propiedad>();
  const tiposOperacion = useTiposOperacionCatalog();
  const tipoOperacionValue = useWatch({ name: "tipo_operacion_id" }) as unknown;
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
    return getPropiedadSectionDefinitions().filter((section) => visibleIds.includes(section.id));
  }, [isAlquiler]);
};

// Inserta el listado de servicios vinculado a la propiedad actual.
const ServiciosSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  const resolvedPropiedadId = propiedadId ?? null;
  const defaultFilters = { propiedad_id: resolvedPropiedadId };
  const permanentFilter = { propiedad_id: resolvedPropiedadId };
  const storeKey = `propiedades-servicios-propiedad-${resolvedPropiedadId}`;

  return (
    <PropiedadEmbeddedSection
      variant={variant}
      title="Servicios"
      persistKey={`propiedades-servicios-${resolvedPropiedadId ?? "sin-propiedad"}`}
      isReady={Boolean(resolvedPropiedadId)}
      emptyMessage="Los servicios estaran disponibles despues de guardar la propiedad."
      renderPlaceholderAsSection={false}
    >
      <RowActionDialogProvider>
        <PropiedadServicioList
          key={storeKey}
          embedded
          propiedadId={resolvedPropiedadId}
          showEmbeddedHeader
          embeddedTitle={<PropiedadEmbeddedSectionTitle title="Servicios" />}
          embeddedExtraActions={
            resolvedPropiedadId ? (
              <PropiedadServiciosAccionesMenu
                propiedadId={resolvedPropiedadId}
                overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
              />
            ) : undefined
          }
          filterDefaultValues={defaultFilters}
          permanentFilter={permanentFilter}
          storeKey={storeKey}
        />
      </RowActionDialogProvider>
    </PropiedadEmbeddedSection>
  );
};

// Inserta el listado de oportunidades de mantenimiento como reparaciones.
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

// Inserta el listado de ordenes y orquesta la seleccion de oportunidad asociada.
const PropiedadOrdenesSection = ({
  variant = "stacked",
}: {
  variant?: PropiedadSectionVariant;
}) => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  const {
    oportunidades,
    isLoading,
    selectorOpen,
    setSelectorOpen,
    handleCreateOrder,
    handleSelectOportunidad,
  } = usePropiedadOrdenesFlow(propiedadId);

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

  return (
    <>
      <PropiedadEmbeddedSection
        variant={variant}
        title="Ordenes"
        persistKey={`propiedades-ordenes-${propiedadId ?? "sin-propiedad"}`}
        isReady={Boolean(propiedadId)}
        emptyMessage="Las ordenes estaran disponibles despues de guardar la propiedad."
        emptyContentClassName="min-h-[22rem] px-4 py-4 xl:px-6 xl:py-5"
      >
        <PoOrderList
          embedded
          showEmbeddedHeader
          embeddedTitle={<PropiedadEmbeddedSectionTitle title="Ordenes" />}
          filterDefaultValues={{ "oportunidad.propiedad_id": propiedadId }}
          storeKey={`po-orders-propiedad-${propiedadId}`}
          createAction={createAction}
        />
      </PropiedadEmbeddedSection>
      <SeleccionarOportunidadOrdenDialog
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        oportunidades={oportunidades}
        onSelect={handleSelectOportunidad}
      />
    </>
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

// Inserta un listado de oportunidades filtrado por propiedad y tipo de operacion.
const OportunidadesListSection = ({
  title,
  propiedadId,
  tipoOperacionId,
  persistKey,
  storeKey,
  variant = "stacked",
  waitForTipoOperacion = false,
}: OportunidadesListSectionProps) => {
  const resolvedPropiedadId = propiedadId ?? null;
  const isReady = Boolean(resolvedPropiedadId) && (!waitForTipoOperacion || Boolean(tipoOperacionId));
  const emptyMessage = !resolvedPropiedadId
    ? `Las ${title.toLowerCase()} estaran disponibles despues de guardar la propiedad.`
    : `Cargando el tipo de operacion para ${title.toLowerCase()}...`;

  return (
    <PropiedadEmbeddedSection
      variant={variant}
      title={title}
      description={`Seguimiento comercial y operativo asociado a la propiedad para ${title.toLowerCase()}.`}
      persistKey={persistKey}
      panelMode="decorated"
      isReady={isReady}
      emptyMessage={emptyMessage}
    >
      {resolvedPropiedadId ? (
        <OportunidadesList
          title={title}
          propiedadId={resolvedPropiedadId}
          tipoOperacionId={tipoOperacionId}
          storeKey={storeKey}
        />
      ) : null}
    </PropiedadEmbeddedSection>
  );
};

// #endregion

// #region Layout de secciones
// Renderiza la navegacion desktop de secciones y la seccion activa.
const PropiedadDesktopSectionsLayout = ({
  activeSection,
  availableSections,
  onSectionChange,
}: {
  activeSection: PropiedadDesktopSectionId;
  availableSections: PropiedadSectionDefinition[];
  onSectionChange: (sectionId: PropiedadDesktopSectionId) => void;
}) => {
  const activeSectionDefinition =
    availableSections.find((section) => section.id === activeSection) ?? availableSections[0];

  return (
    <FormSectionsDesktopLayout
      sections={availableSections}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
    >
      {activeSectionDefinition?.render("panel") ?? null}
    </FormSectionsDesktopLayout>
  );
};

// Define el catalogo de secciones que puede mostrar el formulario de propiedades.
const getPropiedadSectionDefinitions = (): PropiedadSectionDefinition[] => [
  {
    id: "ficha",
    label: "Ficha",
    render: (variant = "stacked") => <FichaSection variant={variant} />,
  },
  {
    id: "servicios",
    label: "Servicios",
    render: (variant = "stacked") => <ServiciosSection variant={variant} />,
  },
  {
    id: "contrato",
    label: "Contrato",
    render: (variant = "stacked") => <DatosContratoSection variant={variant} />,
  },
  {
    id: "reparaciones",
    label: "Reparaciones",
    render: (variant = "stacked") => <ReparacionesSection variant={variant} />,
  },
  {
    id: "ordenes",
    label: "Ordenes",
    render: (variant = "stacked") => <PropiedadOrdenesSection variant={variant} />,
  },
];
// #endregion
