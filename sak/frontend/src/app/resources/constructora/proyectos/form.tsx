"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ListBase,
  required,
  useGetOne,
  useListContext,
  useRecordContext,
} from "ra-core";
import { useWatch } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

import { CRMChatShow } from "@/app/resources/crm/crm-chat";
import { CRMEventoListBody, MinimalActivosToggleFilter } from "@/app/resources/crm/crm-eventos/list";
import { ProyPresupuestoListBody } from "@/app/resources/constructora/proy-presupuesto/List";
import { PoOrderListBody } from "@/app/resources/po/po-orders/List";
import { appendFilterParam, buildOportunidadFilter } from "@/lib/oportunidad-context";
import { cn } from "@/lib/utils";
import { SimpleForm } from "@/components/simple-form";
import { NumberField } from "@/components/number-field";
import {
  DetailFieldCell,
  FormDate,
  FormErrorSummary,
  FORM_FIELD_READONLY_CLASS,
  FormOrderToolbar,
  FormNumber,
  FormSelect,
  FormText,
  FormTextarea,
  FormValue,
  SectionBaseTemplate,
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2,
} from "@/components/forms/form_order";
import { ReferenceInput } from "@/components/reference-input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  PROYECTO_DEFAULTS,
  PROYECTO_VALIDATIONS,
  computeProyectoPresupuestoTotal,
  getProyectoAvanceDefaults,
  getProyectoHorasTotales,
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

const ProyectoChatSection = () => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const oportunidadId = resolveNumericId(record?.oportunidad_id);

  return (
    <SectionBaseTemplate
      title="Chat"
      defaultOpen={false}
      persistKey={`constructora-proyectos-chat-${record?.id ?? "nuevo"}`}
      main={
        oportunidadId ? (
          <CRMChatShow forcedId={`op-${oportunidadId}`} embedded />
        ) : (
          <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            El chat estara disponible despues de guardar el proyecto y generar la oportunidad.
          </div>
        )
      }
    />
  );
};

const ProyectoEventosSection = () => {
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

  if (!oportunidadId) return null;

  return (
    <ListBase
      resource="crm/crm-eventos"
      perPage={200}
      sort={{ field: "fecha_evento", order: "DESC" }}
      filterDefaultValues={defaultFilters}
      disableSyncWithLocation
      storeKey={`crm-eventos-proyecto-${oportunidadId}`}
    >
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
    </ListBase>
  );
};

const ProyectoOrdenesSection = () => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const oportunidadId = resolveNumericId(record?.oportunidad_id);
  const location = useLocation();
  const navigate = useNavigate();

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

  const listTo = useMemo(() => {
    if (!oportunidadId) return "";
    const basePath = "/po-orders";
    const params = new URLSearchParams();
    appendFilterParam(params, buildOportunidadFilter(oportunidadId));
    params.set("returnTo", `${location.pathname}${location.search}`);
    return `${basePath}?${params.toString()}`;
  }, [location.pathname, location.search, oportunidadId]);

  const defaultFilters = useMemo(
    () => ({ oportunidad_id: oportunidadId }),
    [oportunidadId],
  );

  if (!oportunidadId) return null;

  return (
    <ListBase
      resource="po-orders"
      perPage={5}
      sort={{ field: "id", order: "DESC" }}
      filterDefaultValues={defaultFilters}
      disableSyncWithLocation
      storeKey={`po-orders-proyecto-${oportunidadId}`}
    >
      <SectionBaseTemplate
        title="Ordenes"
        defaultOpen={false}
        persistKey={`constructora-proyectos-ordenes-${oportunidadId}`}
        headerSummary={(isOpen) => (isOpen ? <ProyectoOrdenesHeaderSummary /> : null)}
        headerSummaryClassName="text-[9px] text-muted-foreground"
        actions={
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              navigate(createTo);
            }}
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <Plus className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Agregar orden
          </DropdownMenuItem>
        }
        main={
          <div className="flex flex-col gap-2">
            <PoOrderListBody compact showBulkActions={false} />
            <ProyectoOrdenesFooter listTo={listTo} />
          </div>
        }
      />
    </ListBase>
  );
};

const ProyectoOrdenesHeaderSummary = () => {
  const { total, isLoading, isFetching } = useListContext();
  const resolvedTotal = typeof total === "number" && total >= 0 ? total : undefined;
  const label = isLoading || isFetching ? "..." : resolvedTotal ?? "-";

  return <span>Ordenes: {label}</span>;
};

const ProyectoOrdenesFooter = ({ listTo }: { listTo: string }) => {
  const { page, perPage, total, setPage } = useListContext();
  const resolvedTotal = typeof total === "number" && total >= 0 ? total : undefined;
  const totalPages =
    resolvedTotal != null && perPage > 0 ? Math.max(1, Math.ceil(resolvedTotal / perPage)) : 1;
  const canPrev = page > 1;
  const canNext = resolvedTotal != null ? page < totalPages : false;

  return (
    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="px-1 hover:text-foreground disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation();
            if (canPrev) setPage(page - 1);
          }}
          disabled={!canPrev}
          aria-label="Pagina anterior"
        >
          &lt;&lt;
        </button>
        <span>
          pag {page}/{totalPages}
        </span>
        <button
          type="button"
          className="px-1 hover:text-foreground disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation();
            if (canNext) setPage(page + 1);
          }}
          disabled={!canNext}
          aria-label="Pagina siguiente"
        >
          &gt;&gt;
        </button>
      </div>
      <Link
        to={listTo}
        className="font-medium text-primary hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        Mostrar todas
      </Link>
    </div>
  );
};

const ProyectoPresupuestoHeaderSummary = () => {
  const { total, isLoading, isFetching } = useListContext();
  const resolvedTotal = typeof total === "number" && total >= 0 ? total : undefined;
  const label = isLoading || isFetching ? "..." : resolvedTotal ?? "-";

  return <span>Presupuestos: {label}</span>;
};

const ProyectoPresupuestoFooter = ({ listTo }: { listTo: string }) => {
  const { page, perPage, total, setPage } = useListContext();
  const resolvedTotal = typeof total === "number" && total >= 0 ? total : undefined;
  const totalPages =
    resolvedTotal != null && perPage > 0 ? Math.max(1, Math.ceil(resolvedTotal / perPage)) : 1;
  const canPrev = page > 1;
  const canNext = resolvedTotal != null ? page < totalPages : false;

  return (
    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="px-1 hover:text-foreground disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation();
            if (canPrev) setPage(page - 1);
          }}
          disabled={!canPrev}
          aria-label="Pagina anterior"
        >
          &lt;&lt;
        </button>
        <span>
          pag {page}/{totalPages}
        </span>
        <button
          type="button"
          className="px-1 hover:text-foreground disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation();
            if (canNext) setPage(page + 1);
          }}
          disabled={!canNext}
          aria-label="Pagina siguiente"
        >
          &gt;&gt;
        </button>
      </div>
      <Link
        to={listTo}
        className="font-medium text-primary hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        Mostrar todas
      </Link>
    </div>
  );
};

const ProyectoPresupuestoSection = () => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const proyectoId = resolveNumericId(record?.id);
  const location = useLocation();
  const navigate = useNavigate();

  const createTo = useMemo(() => {
    if (!proyectoId) return "";
    const params = new URLSearchParams();
    params.set("proyecto_id", String(proyectoId));
    params.set("returnTo", `${location.pathname}${location.search}`);
    return `/proy-presupuestos/create?${params.toString()}`;
  }, [location.pathname, location.search, proyectoId]);

  const listTo = useMemo(() => {
    if (!proyectoId) return "";
    const params = new URLSearchParams();
    appendFilterParam(params, { proyecto_id: proyectoId });
    params.set("returnTo", `${location.pathname}${location.search}`);
    return `/proy-presupuestos?${params.toString()}`;
  }, [location.pathname, location.search, proyectoId]);

  if (!proyectoId) {
    return (
      <SectionBaseTemplate
        title="Presupuesto"
        defaultOpen={false}
        main={
          <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            El presupuesto estara disponible despues de guardar el proyecto.
          </div>
        }
      />
    );
  }

  return (
    <ListBase
      resource="proy-presupuestos"
      perPage={5}
      sort={{ field: "fecha", order: "DESC" }}
      filterDefaultValues={{ proyecto_id: proyectoId }}
      disableSyncWithLocation
      storeKey={`proy-presupuestos-proyecto-${proyectoId}`}
    >
      <SectionBaseTemplate
        title="Presupuesto"
        defaultOpen={false}
        persistKey={`constructora-proyectos-presupuesto-${proyectoId}`}
        headerSummary={(isOpen) => (isOpen ? <ProyectoPresupuestoHeaderSummary /> : null)}
        headerSummaryClassName="text-[9px] text-muted-foreground"
        actions={
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              navigate(createTo);
            }}
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <Plus className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Agregar presupuesto
          </DropdownMenuItem>
        }
        main={
          <div className="flex flex-col gap-2">
            <ProyPresupuestoListBody compact />
            <ProyectoPresupuestoFooter listTo={listTo} />
          </div>
        }
      />
    </ListBase>
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
    <FormText
      source="estado"
      label="Estado"
      widthClass="w-full"
      maxLength={PROYECTO_VALIDATIONS.ESTADO_MAX}
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

const ProyectoDetalleMainFields = ({ isActive }: SectionDetailFieldsProps) => (
  <>
    <DetailFieldCell label="Fecha" data-focus-field="true">
      <FormDate
        source="fecha_registracion"
        label={false}
        widthClass="w-full"
        readOnly={!isActive}
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Horas">
      <FormNumber
        source="horas"
        label={false}
        widthClass="w-full"
        step="1"
        min={0}
        validate={required()}
        readOnly={!isActive}
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="% Avance">
      <FormNumber
        source="avance"
        label={false}
        widthClass="w-full"
        step="0.01"
        min={0}
        max={100}
        validate={required()}
        readOnly={!isActive}
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Importe">
      <FormNumber
        source="importe"
        label={false}
        widthClass="w-full"
        step="0.01"
        min={0}
        validate={required()}
        readOnly={!isActive}
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Comentario">
      <FormText
        source="comentario"
        label={false}
        widthClass="w-full"
        readOnly={!isActive}
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
  </>
);

const ResumenProyecto = ({ className }: { className?: string }) => {
  const importes = useWatch({
    name: ["importe_mat", "importe_mo", "terceros", "herramientas", "ingresos", "avances"],
  }) as [number?, number?, number?, number?, number?, ProyectoFormValues["avances"]?];

  const [importeMat, importeMo, terceros, herramientas, ingresos, avances] = importes;
  const presupuesto = computeProyectoPresupuestoTotal({
    importe_mat: importeMat,
    importe_mo: importeMo,
    terceros,
    herramientas,
  });
  const horas = getProyectoHorasTotales(avances);
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
  <div className="sticky bottom-0 z-20 mt-2 border-t border-border/60 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85">
    <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
      <ResumenProyecto className="min-w-0 sm:flex-nowrap" />
      <FormOrderToolbar
        className="shrink-0 justify-end flex-nowrap"
        saveProps={{ variant: "secondary" }}
      />
    </div>
  </div>
);

export const ProyectoForm = () => {
  const record = useRecordContext<ProyectoFormValues & { id?: number | string }>();
  const defaultValues = useMemo(
    () => (record?.id ? undefined : PROYECTO_DEFAULTS),
    [record?.id],
  );

  const detailColumns: SectionDetailColumn[] = [
    { label: "Fecha", width: "130px", mobileSpan: 1 },
    { label: "Horas", width: "72px", mobileSpan: 1, className: "text-center" },
    { label: "% Avance", width: "82px", mobileSpan: 1, className: "text-center" },
    { label: "Importe", width: "110px", mobileSpan: 1, className: "text-center" },
    { label: "Comentario", width: "minmax(220px,1fr)", mobileSpan: "full" },
    { label: "", width: "28px" },
  ];

  return (
    <SimpleForm<ProyectoFormValues>
      className="w-full max-w-5xl max-h-[calc(100svh-10rem)] overflow-y-auto overscroll-y-contain pr-1 pb-4 sm:max-h-[calc(100svh-9rem)]"
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
      <ProyectoPresupuestoSection />
      <SectionDetailTemplate2
        title="Certificados"
        detailsSource="avances"
        mainColumns={detailColumns}
        mainFields={ProyectoDetalleMainFields}
        defaults={getProyectoAvanceDefaults}
        maxHeightClassName="md:max-h-56"
        defaultOpen={false}
      />
      <ProyectoOrdenesSection />
      <ProyectoChatSection />
      <ProyectoEventosSection />
    </SimpleForm>
  );
};
