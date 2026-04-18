"use client";

import { useEffect, useMemo } from "react";
import { ListBase, required, useGetIdentity, useGetList, useGetOne, useListContext, useRecordContext } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/forms/form_order/simple_form";
import { ReferenceInput } from "@/components/reference-input";
import {
  FormDate,
  FormErrorSummary,
  FormNumber,
  FormOrderToolbar,
  FormReferenceAutocomplete,
  FormSelectFijo,
  FormText,
  FormTextarea,
  FormValue,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { CRMChatShow } from "@/app/resources/crm/crm-chat";
import { CRMEventoListBody, MinimalActivosToggleFilter } from "@/app/resources/crm/crm-eventos/list";
import { PoOrderListBody } from "@/app/resources/po/po-orders/List";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  appendFilterParam,
  buildOportunidadFilter,
} from "@/lib/oportunidad-context";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCircle2, Plus, Trash2, Workflow } from "lucide-react";

import {
  canUseOportunidadActionForRecord,
  CRM_OPORTUNIDAD_ESTADOS,
  isClosedOportunidad,
  isMantenimientoOportunidad,
  isProspectOportunidad,
} from "./model";
import { captureOportunidadModalBackground } from "./modal_background";

type CRMOportunidadFormValues = Record<string, unknown>;

const parseNumericParam = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const resolveNumericId = (value: unknown) => {
  if (value == null) return undefined;
  if (typeof value === "object") {
    const maybeId = (value as { id?: unknown; value?: unknown }).id ??
      (value as { value?: unknown }).value;
    return resolveNumericId(maybeId);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "0") return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  return undefined;
};

const useLockedPropiedadId = () => {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("lock_propiedad") !== "1") return undefined;
    return parseNumericParam(params.get("propiedad_id"));
  }, [location.search]);
};

const useDefaultTipoOperacionId = () => {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return parseNumericParam(params.get("tipo_operacion_id"));
  }, [location.search]);
};

const useLockedTipoOperacionId = () => {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("lock_tipo_operacion") !== "1") return undefined;
    return parseNumericParam(params.get("tipo_operacion_id"));
  }, [location.search]);
};

const LockedPropiedadSync = ({ lockedPropiedadId }: { lockedPropiedadId?: number }) => {
  const { setValue } = useFormContext<CRMOportunidadFormValues>();
  const propiedadValue = useWatch({ name: "propiedad_id" }) as unknown;

  useEffect(() => {
    if (!lockedPropiedadId) return;
    const current = resolveNumericId(propiedadValue);
    if (current === lockedPropiedadId) return;
    setValue("propiedad_id", lockedPropiedadId, { shouldDirty: false });
  }, [lockedPropiedadId, propiedadValue, setValue]);

  return null;
};

const TipoOperacionDefault = () => {
  const record = useRecordContext<any>();
  const { setValue } = useFormContext<CRMOportunidadFormValues>();
  const tipoOperacionValue = useWatch({ name: "tipo_operacion_id" }) as unknown;
  const defaultTipoOperacionId = useDefaultTipoOperacionId();
  const { data: tiposOperacion = [] } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const alquilerId = useMemo(() => {
    const alquiler = (tiposOperacion as any[]).find(
      (tipo) =>
        tipo?.codigo?.toLowerCase().includes("alquiler") ||
        tipo?.nombre?.toLowerCase().includes("alquiler"),
    );
    return alquiler?.id ? Number(alquiler.id) : undefined;
  }, [tiposOperacion]);

  useEffect(() => {
    if (record?.id) return;
    const fallbackTipoOperacionId = defaultTipoOperacionId ?? alquilerId;
    if (!fallbackTipoOperacionId) return;
    const current = resolveNumericId(tipoOperacionValue);
    if (current) return;
    setValue("tipo_operacion_id", fallbackTipoOperacionId, { shouldDirty: false });
  }, [alquilerId, defaultTipoOperacionId, record?.id, setValue, tipoOperacionValue]);

  return null;
};

const TipoPropiedadFromPropiedadSync = () => {
  const record = useRecordContext<any>();
  const { setValue } = useFormContext<CRMOportunidadFormValues>();
  const lockedPropiedadId = useLockedPropiedadId();
  const { isMantenimiento } = useMantenimientoRules();
  const propiedadValue = useWatch({ name: "propiedad_id" }) as unknown;
  const tipoPropiedadValue = useWatch({ name: "tipo_propiedad_id" }) as unknown;

  const propiedadId = lockedPropiedadId ?? resolveNumericId(propiedadValue);
  const currentTipoPropiedadId = resolveNumericId(tipoPropiedadValue);
  const { data: propiedad } = useGetOne(
    "propiedades",
    { id: propiedadId ?? 0 },
    { enabled: Boolean(propiedadId) },
  );
  const propiedadTipoPropiedadId = resolveNumericId((propiedad as any)?.tipo_propiedad_id);

  useEffect(() => {
    if (record?.id || !isMantenimiento) return;

    if (!propiedadId) {
      if (currentTipoPropiedadId == null) return;
      setValue("tipo_propiedad_id", undefined, { shouldDirty: false });
      return;
    }

    if (!propiedadTipoPropiedadId) return;
    if (currentTipoPropiedadId === propiedadTipoPropiedadId) return;

    setValue("tipo_propiedad_id", propiedadTipoPropiedadId, { shouldDirty: false });
  }, [
    currentTipoPropiedadId,
    isMantenimiento,
    propiedadId,
    propiedadTipoPropiedadId,
    record?.id,
    setValue,
  ]);

  return null;
};

const ContactoFromPropiedadSync = () => {
  const record = useRecordContext<any>();
  const { setValue } = useFormContext<CRMOportunidadFormValues>();
  const lockedPropiedadId = useLockedPropiedadId();
  const contactoValue = useWatch({ name: "contacto_id" }) as unknown;
  const currentContactoId = resolveNumericId(contactoValue);
  const { data: propiedad } = useGetOne(
    "propiedades",
    { id: lockedPropiedadId ?? 0 },
    { enabled: Boolean(lockedPropiedadId) },
  );
  const propiedadContactoId = resolveNumericId((propiedad as any)?.contacto_id);

  useEffect(() => {
    if (record?.id || !lockedPropiedadId) return;
    if (!propiedadContactoId || currentContactoId) return;
    setValue("contacto_id", propiedadContactoId, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [
    currentContactoId,
    lockedPropiedadId,
    propiedadContactoId,
    record?.id,
    setValue,
  ]);

  return null;
};

const MantenimientoCreateStateSync = () => {
  const record = useRecordContext<any>();
  const { setValue } = useFormContext<CRMOportunidadFormValues>();
  const { isMantenimiento } = useMantenimientoRules();
  const estadoValue = useWatch({ name: "estado" }) as unknown;
  const activoValue = useWatch({ name: "activo" }) as unknown;

  useEffect(() => {
    if (record?.id) return;

    const desiredEstado = isMantenimiento ? "1-abierta" : CRM_OPORTUNIDAD_ESTADOS[0];
    const desiredActivo = isMantenimiento;

    if (estadoValue !== desiredEstado) {
      setValue("estado", desiredEstado, { shouldDirty: false });
    }
    if (Boolean(activoValue) !== desiredActivo) {
      setValue("activo", desiredActivo, { shouldDirty: false });
    }
  }, [activoValue, estadoValue, isMantenimiento, record?.id, setValue]);

  return null;
};

const useMantenimientoRules = () => {
  const tipoOperacionValue = useWatch({ name: "tipo_operacion_id" }) as unknown;
  const resolvedTipoOperacionId = resolveNumericId(tipoOperacionValue);
  const { data: tiposOperacion = [] } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const mantenimientoIds = useMemo(() => {
    return new Set(
      (tiposOperacion as any[])
        .filter((tipo) => {
          const key = String(tipo?.codigo ?? tipo?.nombre ?? "").toLowerCase();
          return key.includes("mantenimiento");
        })
        .map((tipo) => Number(tipo.id))
        .filter((id) => Number.isFinite(id)),
    );
  }, [tiposOperacion]);

  const isMantenimiento = resolvedTipoOperacionId
    ? mantenimientoIds.has(Number(resolvedTipoOperacionId))
    : false;

  const validatePropiedad = useMemo(
    () => (value: unknown, allValues: Record<string, unknown>) => {
      const tipoId = resolveNumericId(allValues?.tipo_operacion_id);
      if (tipoId && mantenimientoIds.has(Number(tipoId))) {
        return resolveNumericId(value) ? undefined : "Propiedad obligatoria";
      }
      return undefined;
    },
    [mantenimientoIds],
  );

  const propiedadValidators = useMemo(
    () => (isMantenimiento ? [required(), validatePropiedad] : validatePropiedad),
    [isMantenimiento, validatePropiedad],
  );

  return { isMantenimiento, validatePropiedad: propiedadValidators };
};

export const CRMOportunidadForm = () => {
  const record = useRecordContext<any>();
  const { identity } = useGetIdentity();
  const lockedPropiedadId = useLockedPropiedadId();
  const isCreate = !record?.id;
  const defaultValues = useMemo(
    () => ({
      responsable_id: identity?.id ?? undefined,
      estado: CRM_OPORTUNIDAD_ESTADOS[0],
      activo: false,
      fecha_estado: new Date().toISOString().slice(0, 10),
      ...(isCreate && lockedPropiedadId ? { propiedad_id: lockedPropiedadId } : {}),
    }),
    [identity?.id, isCreate, lockedPropiedadId],
  );

  return (
    <SimpleForm<CRMOportunidadFormValues>
      className="w-full max-w-3xl"
      toolbar={<FormOrderToolbar saveProps={{ alwaysEnable: true }} />}
      defaultValues={defaultValues}
    >
      <FormErrorSummary />
      {lockedPropiedadId ? <HiddenInput source="propiedad_id" /> : null}
      <LockedPropiedadSync lockedPropiedadId={lockedPropiedadId} />
      <TipoOperacionDefault />
      <MantenimientoCreateStateSync />
      <TipoPropiedadFromPropiedadSync />
      <ContactoFromPropiedadSync />
      <CabeceraSection />
      <ChatSection />
      <EventosSection />
      <OrdenesSection />
      <SectionBaseTemplate
        title="Cotizacion"
        main={<SeguimientoFields />}
        defaultOpen={false}
      />
    </SimpleForm>
  );
};

const CabeceraSection = () => {
  const record = useRecordContext<any>();
  const hasActions =
    Boolean(record?.id) &&
    (isProspectOportunidad(record?.estado) || !isClosedOportunidad(record?.estado));

  return (
    <SectionBaseTemplate
      title="Cabecera"
      main={<CabeceraFields />}
      optional={<CabeceraOpcionales />}
      defaultOpen
      actions={hasActions ? <CabeceraActionsMenu /> : undefined}
    />
  );
};

const CabeceraActionsMenu = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  const listReturnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ??
    "/crm/oportunidades";

  if (!record?.id) return null;

  const goTo = (
    path: string,
    state?: Record<string, unknown>,
    nextReturnTo = returnTo,
  ) => {
    navigate(path, {
      state: {
        returnTo: nextReturnTo,
        background: captureOportunidadModalBackground(),
        ...state,
      },
    });
  };

  const canAgendar = canUseOportunidadActionForRecord(record, "agendar");
  const canCotizar = canUseOportunidadActionForRecord(record, "cotizar");
  const canReservar = canUseOportunidadActionForRecord(record, "reservar");
  const canCerrar = canUseOportunidadActionForRecord(record, "cerrar");
  const hasStateActions = canAgendar || canCotizar || canReservar || canCerrar;

  return (
    <>
      {isProspectOportunidad(record.estado) && !isMantenimientoOportunidad(record) ? (
        <>
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
              goTo(`/crm/oportunidades/${record.id}/accion_descartar`, {
                record: recordPayload,
              }, listReturnTo);
            }}
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
            variant="destructive"
          >
            <Trash2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Eliminar
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_aceptar`, {
                background: captureOportunidadModalBackground(),
              });
            }}
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <CheckCircle2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Confirmar
          </DropdownMenuItem>
        </>
      ) : null}

      {!isClosedOportunidad(record.estado) && hasStateActions ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]">
            <Workflow className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Cambiar estado
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-28 sm:w-36">
            {canAgendar ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.stopPropagation();
                  goTo(`/crm/oportunidades/${record.id}/accion_agendar`);
                }}
                className="px-1.5 py-1 text-[8px] sm:text-[10px]"
              >
                Agendar
              </DropdownMenuItem>
            ) : null}
            {canCotizar ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.stopPropagation();
                  goTo(`/crm/oportunidades/${record.id}/accion_cotizar`);
                }}
                className="px-1.5 py-1 text-[8px] sm:text-[10px]"
              >
                Cotizar
              </DropdownMenuItem>
            ) : null}
            {canReservar ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.stopPropagation();
                  goTo(`/crm/oportunidades/${record.id}/accion_reservar`);
                }}
                className="px-1.5 py-1 text-[8px] sm:text-[10px]"
              >
                Reservar
              </DropdownMenuItem>
            ) : null}
            {canCerrar ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.stopPropagation();
                  goTo(`/crm/oportunidades/${record.id}/accion_cerrar`);
                }}
                className="px-1.5 py-1 text-[8px] sm:text-[10px]"
              >
                Cerrar
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : null}
    </>
  );
};

const CabeceraFields = () => {
  const lockedPropiedadId = useLockedPropiedadId();
  const lockedTipoOperacionId = useLockedTipoOperacionId();
  const { isMantenimiento, validatePropiedad } = useMantenimientoRules();
  const { data: propiedadLocked } = useGetOne(
    "propiedades",
    { id: lockedPropiedadId ?? 0 },
    { enabled: Boolean(lockedPropiedadId) },
  );
  const { data: tipoOperacionLocked } = useGetOne(
    "crm/catalogos/tipos-operacion",
    { id: lockedTipoOperacionId ?? 0 },
    { enabled: Boolean(lockedTipoOperacionId) },
  );
  const propiedadLabel =
    (propiedadLocked as any)?.nombre ??
    (lockedPropiedadId ? `Propiedad #${lockedPropiedadId}` : "Sin asignar");
  const tipoOperacionLabel =
    (tipoOperacionLocked as any)?.nombre ??
    (lockedTipoOperacionId ? `Tipo operacion #${lockedTipoOperacionId}` : "Sin asignar");

  return (
    <div
      className={
        isMantenimiento
          ? "grid gap-2 md:items-end md:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_110px_minmax(0,1.45fr)_minmax(0,1.75fr)]"
          : "grid gap-2 md:items-end md:grid-cols-[minmax(0,2.8fr)_minmax(0,2.1fr)_110px_minmax(0,1.6fr)]"
      }
    >
      <FormText
        source="titulo"
        label="Titulo"
        validate={required()}
        widthClass="w-full min-w-0 md:max-w-[190px]"
      />
      <FormReferenceAutocomplete
        referenceProps={{
          source: "contacto_id",
          reference: "crm/contactos",
        }}
        inputProps={{
          optionText: "nombre_completo",
          label: "Contacto",
          validate: required(),
        }}
        widthClass="w-full min-w-0 md:max-w-[190px]"
      />
      {lockedTipoOperacionId ? (
        <FormValue
          label="Tipo operacion"
          widthClass="w-full min-w-0"
          valueClassName="justify-start text-left"
        >
          {tipoOperacionLabel}
        </FormValue>
      ) : (
        <ReferenceInput
          source="tipo_operacion_id"
          reference="crm/catalogos/tipos-operacion"
        >
          <FormSelectFijo
            optionText="nombre"
            label="Tipo operacion"
            widthClass="w-full min-w-0"
            fixedWidth="110px"
          />
        </ReferenceInput>
      )}
      <FormReferenceAutocomplete
        referenceProps={{ source: "responsable_id", reference: "users" }}
        inputProps={{
          optionText: "nombre",
          label: "Responsable",
          validate: required(),
        }}
        widthClass="w-full min-w-0"
      />
      {isMantenimiento ? (
        lockedPropiedadId ? (
          <FormValue
            label="Propiedad"
            widthClass="w-full min-w-0 md:max-w-[170px]"
            valueClassName="justify-start text-left"
          >
            {propiedadLabel}
          </FormValue>
        ) : (
          <FormReferenceAutocomplete
            referenceProps={{
              source: "propiedad_id",
              reference: "propiedades",
            }}
            inputProps={{
              optionText: "nombre",
              label: "Propiedad",
              validate: validatePropiedad,
            }}
            widthClass="w-full min-w-0 md:max-w-[170px]"
          />
        )
      ) : null}
    </div>
  );
};

const CabeceraOpcionales = () => {
  const lockedPropiedadId = useLockedPropiedadId();
  const { isMantenimiento, validatePropiedad } = useMantenimientoRules();
  const { data: propiedadLocked } = useGetOne(
    "propiedades",
    { id: lockedPropiedadId ?? 0 },
    { enabled: Boolean(lockedPropiedadId) },
  );
  const propiedadLabel =
    (propiedadLocked as any)?.nombre ??
    (lockedPropiedadId ? `Propiedad #${lockedPropiedadId}` : "Sin asignar");

  return (
    <div className="mt-1 space-y-0">
      <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
        <div className="grid gap-2 md:grid-cols-12">
          {!isMantenimiento ? (
            lockedPropiedadId ? (
              <FormValue
                label="Propiedad"
                widthClass="w-full md:col-span-4 md:max-w-[190px]"
                valueClassName="justify-start text-left"
              >
                {propiedadLabel}
              </FormValue>
            ) : (
              <FormReferenceAutocomplete
                referenceProps={{
                  source: "propiedad_id",
                  reference: "propiedades",
                }}
                inputProps={{
                  optionText: "nombre",
                  label: "Propiedad",
                  validate: validatePropiedad,
                }}
                widthClass="w-full md:col-span-4 md:max-w-[190px]"
              />
            )
          ) : null}
        <FormReferenceAutocomplete
          referenceProps={{
            source: "tipo_propiedad_id",
            reference: "tipos-propiedad",
          }}
          inputProps={{
            optionText: "nombre",
            label: "Tipo propiedad",
          }}
          widthClass="w-full md:col-span-3"
        />
        <FormReferenceAutocomplete
          referenceProps={{
            source: "emprendimiento_id",
            reference: "emprendimientos",
          }}
          inputProps={{
            optionText: "nombre",
            label: "Emprendimiento",
          }}
          widthClass="w-full md:col-span-3"
        />
        <FormTextarea
          source="descripcion_estado"
          label="Descripcion"
          widthClass="w-full md:col-span-12"
          className="[&_textarea]:min-h-[70px]"
        />
      </div>
    </div>
    </div>
  );
};

const ChatSection = () => {
  const record = useRecordContext<any>();
  const oportunidadId = record?.id;

  return (
    <SectionBaseTemplate
      title="Chat"
      defaultOpen={false}
      persistKey={`crm-oportunidades-chat-${oportunidadId ?? "nuevo"}`}
      main={
        oportunidadId ? (
          <CRMChatShow forcedId={`op-${oportunidadId}`} embedded />
        ) : (
          <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            El chat estara disponible despues de guardar la oportunidad.
          </div>
        )
      }
    />
  );
};

const CotizacionFields = () => (
  <div className="grid gap-2 md:grid-cols-4">
    <FormNumber
      source="monto"
      label="Monto"
      step="any"
      min={0}
      widthClass="w-full"
    />
    <FormReferenceAutocomplete
      referenceProps={{ source: "moneda_id", reference: "monedas" }}
      inputProps={{
        optionText: (record) =>
          record?.simbolo ? `${record.simbolo}` : record?.codigo || record?.nombre,
        label: "Moneda",
      }}
      widthClass="w-full"
    />
    <FormReferenceAutocomplete
      referenceProps={{
        source: "condicion_pago_id",
        reference: "crm/catalogos/condiciones-pago",
      }}
      inputProps={{
        optionText: "nombre",
        label: "Condicion pago",
      }}
      widthClass="w-full md:col-span-2"
    />
    <FormTextarea
      source="forma_pago_descripcion"
      label="Descripcion forma de pago"
      widthClass="w-full md:col-span-4"
      className="[&_textarea]:min-h-[64px]"
    />
  </div>
);

const SeguimientoFields = () => (
  <div className="space-y-2">
    <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
      <div className="mb-2 text-[10px] font-semibold text-muted-foreground">
        Cotizacion
      </div>
      <CotizacionFields />
    </div>
    <div className="grid gap-2 md:grid-cols-4">
      <FormNumber
        source="probabilidad"
        label="Probabilidad (%)"
        min={0}
        max={100}
        widthClass="w-full"
      />
      <FormDate
        source="fecha_cierre_estimada"
        label="Cierre estimado"
        widthClass="w-full"
      />
      <FormReferenceAutocomplete
        referenceProps={{
          source: "motivo_perdida_id",
          reference: "crm/catalogos/motivos-perdida",
        }}
        inputProps={{
          optionText: "nombre",
          label: "Motivo perdida",
        }}
        widthClass="w-full md:col-span-2"
      />
    </div>
  </div>
);

const EventosSection = () => {
  const record = useRecordContext<any>();
  const oportunidadId = record?.id;
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = `${location.pathname}${location.search}`;

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
        record?.contacto_id ? { contacto_id: record.contacto_id } : undefined,
      ),
    );
    params.set("returnTo", returnTo);
    return `${basePath}?${params.toString()}`;
  }, [oportunidadId, record?.contacto_id, returnTo]);

  if (!oportunidadId) return null;

  return (
    <ListBase
      resource="crm/crm-eventos"
      perPage={200}
      sort={{ field: "fecha_evento", order: "DESC" }}
      filterDefaultValues={defaultFilters}
      disableSyncWithLocation
      storeKey={`crm-eventos-oportunidad-${oportunidadId}`}
    >
      <SectionBaseTemplate
        title="Eventos"
        defaultOpen={false}
        persistKey={`crm-oportunidades-eventos-${oportunidadId}`}
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

const OrdenesSection = () => {
  const record = useRecordContext<any>();
  const oportunidadId = record?.id;
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
  }, [oportunidadId, location.pathname, location.search]);

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
      storeKey={`po-orders-oportunidad-${oportunidadId}`}
    >
      <SectionBaseTemplate
        title="Ordenes"
        defaultOpen={false}
        persistKey={`crm-oportunidades-ordenes-${oportunidadId}`}
        headerSummary={(isOpen) => (isOpen ? <OrdenesHeaderSummary /> : null)}
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
            <OrdenesFooter listTo={listTo} />
          </div>
        }
      />
    </ListBase>
  );
};

const OrdenesHeaderSummary = () => {
  const { total, isLoading, isFetching } = useListContext();
  const resolvedTotal = typeof total === "number" && total >= 0 ? total : undefined;
  const label = isLoading || isFetching ? "..." : resolvedTotal ?? "-";

  return <span>Ordenes: {label}</span>;
};

const OrdenesFooter = ({ listTo }: { listTo: string }) => {
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

export default CRMOportunidadForm;
