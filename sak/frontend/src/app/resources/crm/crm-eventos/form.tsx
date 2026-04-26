"use client";

import { useEffect, useMemo, useRef } from "react";
import { required, useGetIdentity, useGetList, useGetOne, useRecordContext } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ResourceTitle } from "@/components/resource-title";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import {
  FormErrorSummary,
  FormOrderToolbar,
  FormReferenceAutocomplete,
  FormText,
  FormTextarea,
  FormValue,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { Button } from "@/components/ui/button";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";

const CRMEventoFormContent = ({ lockedOportunidadId }: { lockedOportunidadId?: number }) => {
  const record = useRecordContext();
  const form = useFormContext();
  const { data: identity } = useGetIdentity();
  const isEdit = Boolean(record?.id);
  const descripcionValue = useWatch({ control: form.control, name: "descripcion" });
  const contactoIdRaw = useWatch({ control: form.control, name: "contacto_id" });
  const initialOportunidadIdRef = useRef(form.getValues("oportunidad_id"));
  const initialContactoIdRef = useRef(form.getValues("contacto_id"));
  const fechaTransformadaRef = useRef(false);

  const { data: tiposEventoCatalogo = [] } = useGetList("crm/catalogos/tipos-evento", {
    pagination: { page: 1, perPage: 200 },
    filter: { activo: true },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: motivosEventoCatalogo = [] } = useGetList("crm/catalogos/motivos-evento", {
    pagination: { page: 1, perPage: 200 },
    filter: { activo: true },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: contactosActivos = [] } = useGetList<any>("crm/contactos", {
    pagination: { page: 1, perPage: 200 },
    filter: {},
    sort: { field: "nombre_completo", order: "ASC" },
  });
  const shouldLockFromOportunidad =
    typeof lockedOportunidadId === "number" &&
    Number.isFinite(lockedOportunidadId) &&
    lockedOportunidadId > 0;
  const { data: oportunidadLocked } = useGetOne(
    "crm/oportunidades",
    { id: lockedOportunidadId ?? undefined },
    { enabled: shouldLockFromOportunidad }
  );
  const lockedContactoId = (oportunidadLocked as any)?.contacto_id ?? null;
  const { data: contactoLocked } = useGetOne(
    "crm/contactos",
    { id: lockedContactoId ?? 0 },
    { enabled: shouldLockFromOportunidad && Boolean(lockedContactoId) }
  );

  const selectedTipo = useMemo(
    () =>
      tiposEventoCatalogo.find((tipo: any) => tipo.id === form.getValues("tipo_id")),
    [tiposEventoCatalogo, form]
  );
  const selectedContacto = useMemo(
    () =>
      contactosActivos.find(
        (contacto: any) => String(contacto.id) === String(contactoIdRaw ?? "")
      ),
    [contactosActivos, contactoIdRaw]
  );
  const selectedContactoId = useMemo(() => {
    const numeric = Number(contactoIdRaw);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }, [contactoIdRaw]);
  const { data: oportunidadesContactoData = [] } = useGetList<any>(
    "crm/oportunidades",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "fecha_estado", order: "DESC" },
      filter: { contacto_id: selectedContactoId, activo: true },
    },
    { enabled: Boolean(selectedContactoId) }
  );
  const lastActiveOportunidadId = oportunidadesContactoData?.[0]?.id ?? null;

  const formatDateTimeInput = (date: Date | string | null | undefined) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const formEl = document.querySelector('form[data-form-scope="main"]');
    if (!formEl) return;
    const focusable = formEl.querySelector<HTMLElement>(
      '[role="combobox"], input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
    );
    if (focusable) {
      requestAnimationFrame(() => focusable.focus());
    }
  }, []);

  // Transformar fecha_evento al formato datetime-local cuando se carga el record en modo edit
  useEffect(() => {
    if (!isEdit || !record?.fecha_evento || fechaTransformadaRef.current) return;

    const currentValue = form.getValues("fecha_evento");
    const formattedDate = formatDateTimeInput(record.fecha_evento);
    if (formattedDate && currentValue !== formattedDate) {
      form.setValue("fecha_evento", formattedDate, { shouldDirty: false });
      fechaTransformadaRef.current = true;
    }
  }, [isEdit, record?.fecha_evento, form]);

  useEffect(() => {
    if (isEdit) return;
    const asignado = form.getValues("asignado_a_id");
    if (!asignado && identity?.id) {
      form.setValue("asignado_a_id", identity.id, { shouldDirty: false });
    }
  }, [form, identity?.id, isEdit]);

  useEffect(() => {
    if (isEdit) return;
    if (!form.getValues("tipo_id") && tiposEventoCatalogo.length > 0) {
      const defaultTipo =
        tiposEventoCatalogo.find((tipo: any) => tipo.codigo === "llamada") ??
        tiposEventoCatalogo[0];
      if (defaultTipo) {
        form.setValue("tipo_id", defaultTipo.id, { shouldDirty: true });
      }
    }
  }, [form, tiposEventoCatalogo, isEdit]);

  useEffect(() => {
    if (isEdit) return;
    if (!form.getValues("motivo_id") && motivosEventoCatalogo.length > 0) {
      form.setValue("motivo_id", motivosEventoCatalogo[0].id, { shouldDirty: true });
    }
  }, [form, motivosEventoCatalogo, isEdit]);

  useEffect(() => {
    if (selectedTipo?.codigo) {
      form.setValue("tipo_evento", selectedTipo.codigo, { shouldDirty: false });
    }
  }, [form, selectedTipo?.codigo]);

  useEffect(() => {
    if (descripcionValue == null) {
      form.setValue("descripcion", "", { shouldDirty: false });
    }
  }, [descripcionValue, form]);

  useEffect(() => {
    if (typeof contactoIdRaw === "string") {
      const numeric = Number(contactoIdRaw);
      if (Number.isFinite(numeric) && Number(contactoIdRaw) === numeric) {
        form.setValue("contacto_id", numeric, { shouldDirty: true });
      }
    }
  }, [contactoIdRaw, form]);

  useEffect(() => {
    if (shouldLockFromOportunidad) return;
    if (!selectedContactoId) {
      if (!isEdit && initialOportunidadIdRef.current == null) {
        form.setValue("oportunidad_id", null, { shouldDirty: true });
      }
      return;
    }
    if (
      isEdit &&
      initialContactoIdRef.current != null &&
      String(initialContactoIdRef.current) === String(selectedContactoId)
    ) {
      return;
    }
    const nextValue =
      typeof lastActiveOportunidadId === "number" ? lastActiveOportunidadId : null;
    if (form.getValues("oportunidad_id") !== nextValue) {
      form.setValue("oportunidad_id", nextValue, { shouldDirty: true });
    }
  }, [
    form,
    isEdit,
    lastActiveOportunidadId,
    selectedContactoId,
    shouldLockFromOportunidad,
  ]);

  useEffect(() => {
    if (!shouldLockFromOportunidad) return;
    if (lockedOportunidadId != null) {
      form.setValue("oportunidad_id", lockedOportunidadId, { shouldDirty: false });
    }
    if (lockedContactoId != null) {
      form.setValue("contacto_id", lockedContactoId, { shouldDirty: false });
    }
  }, [form, lockedContactoId, lockedOportunidadId, shouldLockFromOportunidad]);

  const contactoLabel =
    (contactoLocked as any)?.nombre_completo ??
    (contactoLocked as any)?.nombre ??
    (lockedContactoId ? `Contacto #${lockedContactoId}` : "");

  const oportunidadLabel =
    (oportunidadLocked as any)?.titulo ??
    (oportunidadLocked as any)?.descripcion_estado ??
    (lockedOportunidadId ? `Oportunidad #${lockedOportunidadId}` : "");

  return (
    <SectionBaseTemplate
      title="Cabecera"
      main={
        <div className="grid gap-2 md:grid-cols-4">
          <FormReferenceAutocomplete
            referenceProps={{
              source: "tipo_id",
              reference: "crm/catalogos/tipos-evento",
              filter: { activo: true },
              perPage: 200,
            }}
            inputProps={{
              optionText: "nombre",
              label: "Tipo de evento",
              validate: required(),
            }}
            widthClass="w-full md:col-span-2"
          />

          <FormText
            source="fecha_evento"
            label="Fecha y hora"
            type="datetime-local"
            format={formatDateTimeInput}
            validate={required()}
            widthClass="w-full md:col-span-2"
          />

          <FormText
            source="titulo"
            label="Titulo"
            validate={required()}
            widthClass="w-full md:col-span-4"
          />

          {shouldLockFromOportunidad ? (
            <>
              <FormValue
                label="Contacto"
                widthClass="w-full md:col-span-4"
                valueClassName="justify-start text-left"
              >
                {contactoLabel || "-"}
              </FormValue>
              <FormValue
                label="Oportunidad"
                widthClass="w-full md:col-span-4"
                valueClassName="justify-start text-left"
              >
                {oportunidadLabel || "-"}
              </FormValue>
            </>
          ) : (
            <>
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
                widthClass="w-full md:col-span-4"
              />
              <FormReferenceAutocomplete
                referenceProps={{
                  source: "oportunidad_id",
                  reference: "crm/oportunidades",
                  filter: selectedContactoId ? { contacto_id: selectedContactoId, activo: true } : undefined,
                }}
                inputProps={{
                  optionText: "titulo",
                  label: "Oportunidad",
                }}
                widthClass="w-full md:col-span-4"
              />
            </>
          )}

          <FormTextarea
            source="descripcion"
            label="Descripcion"
            widthClass="w-full md:col-span-4"
            className="[&_textarea]:min-h-[70px]"
          />

          <FormReferenceAutocomplete
            referenceProps={{
              source: "asignado_a_id",
              reference: "users",
            }}
            inputProps={{
              optionText: "nombre",
              label: "Asignado a",
            }}
            widthClass="w-full md:col-span-4"
          />
        </div>
      }
    />
  );
};

type CRMEventoFormProps = {
  defaultValues?: Record<string, unknown>;
  lockedOportunidadId?: number;
};

type CRMEventoFormTitleProps = {
  icon: LucideIcon;
  text: string;
};

export const CRMEventoFormTitle = ({ icon, text }: CRMEventoFormTitleProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = getReturnToFromLocation(location);

  const handleBack = () => {
    if (returnTo) {
      navigate(returnTo);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/crm/crm-eventos");
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        className="h-6 px-1.5 text-[11px] font-medium text-primary"
        onClick={handleBack}
      >
        <ArrowLeft className="mr-1 h-3 w-3" />
        Volver
      </Button>
      <ResourceTitle
        icon={icon}
        text={text}
        className="gap-2 text-lg"
        iconWrapperClassName="h-9 w-9 rounded-xl"
        iconClassName="h-5 w-5"
      />
    </div>
  );
};

export const CRMEventoForm = ({ defaultValues, lockedOportunidadId }: CRMEventoFormProps) => {
  return (
    <div className="w-full max-w-md">
      <SimpleForm
        defaultValues={defaultValues}
        className="w-full"
        toolbar={<FormOrderToolbar saveProps={{ tabIndex: 0 }} />}
      >
        <FormErrorSummary />
        <CRMEventoFormContent lockedOportunidadId={lockedOportunidadId} />
        <HiddenInput source="tipo_evento" />
        <HiddenInput source="motivo_id" />
        <HiddenInput source="contacto_id" />
        <HiddenInput source="oportunidad_id" />
        <HiddenInput source="estado_evento" defaultValue="1-pendiente" />
      </SimpleForm>
    </div>
  );
};
