"use client";

import { useEffect, useMemo } from "react";
import { ListBase, required, useGetIdentity, useGetList, useGetOne, useRecordContext } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import {
  FormDate,
  FormErrorSummary,
  FormNumber,
  FormOrderToolbar,
  FormReferenceAutocomplete,
  FormSelect,
  FormSelectFijo,
  FormText,
  FormTextarea,
  FormValue,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { CRMEventoListBody, MinimalActivosToggleFilter } from "@/app/resources/crm/crm-eventos/list";
import { PoOrderListBody } from "@/app/resources/po/po-orders/List";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  appendFilterParam,
  buildOportunidadFilter,
} from "@/lib/oportunidad-context";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";

import {
  CRM_OPORTUNIDAD_ESTADO_CHOICES,
  CRM_OPORTUNIDAD_ESTADOS,
} from "./model";

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
    return parseNumericParam(params.get("propiedad_id"));
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

const TipoOperacionAlquilerDefault = () => {
  const record = useRecordContext<any>();
  const { setValue } = useFormContext<CRMOportunidadFormValues>();
  const tipoOperacionValue = useWatch({ name: "tipo_operacion_id" }) as unknown;
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
    if (!alquilerId) return;
    const current = resolveNumericId(tipoOperacionValue);
    if (current) return;
    setValue("tipo_operacion_id", alquilerId, { shouldDirty: false });
  }, [alquilerId, record?.id, setValue, tipoOperacionValue]);

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

export const CRMOportunidadPoForm = () => {
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
      toolbar={<FormOrderToolbar />}
      defaultValues={defaultValues}
    >
      <FormErrorSummary />
      {lockedPropiedadId ? <HiddenInput source="propiedad_id" /> : null}
      <LockedPropiedadSync lockedPropiedadId={lockedPropiedadId} />
      <TipoOperacionAlquilerDefault />
      <SectionBaseTemplate
        title="Cabecera"
        main={<CabeceraFields />}
        optional={<CabeceraOpcionales />}
        defaultOpen
      />
      <EventosSection />
      <OrdenesSection />
      <SectionBaseTemplate
        title="Seguimiento"
        main={<SeguimientoFields />}
        defaultOpen={false}
      />
    </SimpleForm>
  );
};

const CabeceraFields = () => {
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
    <div className="grid gap-2 md:grid-cols-12">
      <FormText
        source="titulo"
        label="Titulo"
        validate={required()}
        widthClass="w-full md:col-span-3"
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
        widthClass="w-full md:col-span-3"
      />
      <ReferenceInput
        source="tipo_operacion_id"
        reference="crm/catalogos/tipos-operacion"
      >
        <FormSelectFijo
          optionText="nombre"
          label="Tipo operacion"
          widthClass="w-full md:col-span-2"
          fixedWidth="110px"
        />
      </ReferenceInput>
      <FormReferenceAutocomplete
        referenceProps={{ source: "responsable_id", reference: "users" }}
        inputProps={{
          optionText: "nombre",
          label: "Responsable",
          validate: required(),
        }}
        widthClass="w-full md:col-span-2"
      />
      {isMantenimiento ? (
        lockedPropiedadId ? (
          <FormValue label="Propiedad" widthClass="w-full md:col-span-4">
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
            widthClass="w-full md:col-span-4"
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
              <FormValue label="Propiedad" widthClass="w-full md:col-span-4">
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
                widthClass="w-full md:col-span-4"
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
    <div className="mt-2 rounded-md border border-muted/60 bg-muted/30 p-2">
      <div className="mb-2 text-[10px] font-semibold text-muted-foreground">
        Cotizacion
      </div>
      <CotizacionFields />
    </div>
    </div>
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

  if (!oportunidadId) return null;

  const createTo = useMemo(() => {
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

  if (!oportunidadId) return null;

  const createTo = useMemo(() => {
    const basePath = "/po-orders/create";
    const params = new URLSearchParams();
    params.set("oportunidad_id", String(oportunidadId));
    params.set("lock_oportunidad", "1");
    params.set("lock_centro", "1");
    params.set("returnTo", `${location.pathname}${location.search}`);
    return `${basePath}?${params.toString()}`;
  }, [oportunidadId, location.pathname, location.search]);

  const listTo = useMemo(() => {
    const basePath = "/po-orders";
    const params = new URLSearchParams();
    appendFilterParam(params, buildOportunidadFilter(oportunidadId));
    return `${basePath}?${params.toString()}`;
  }, [oportunidadId]);

  return (
    <ListBase
      resource="po-orders"
      perPage={10}
      sort={{ field: "id", order: "DESC" }}
      filterDefaultValues={{ oportunidad_id: oportunidadId }}
      disableSyncWithLocation
      storeKey={`po-orders-oportunidad-${oportunidadId}`}
    >
      <SectionBaseTemplate
        title="Ordenes"
        defaultOpen={false}
        persistKey={`crm-oportunidades-ordenes-${oportunidadId}`}
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
            <PoOrderListBody compact />
            <div className="flex items-center justify-end text-[9px] text-muted-foreground">
              <Link
                to={listTo}
                className="font-medium text-primary hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Mostrar todas
              </Link>
            </div>
          </div>
        }
      />
    </ListBase>
  );
};

export default CRMOportunidadPoForm;
