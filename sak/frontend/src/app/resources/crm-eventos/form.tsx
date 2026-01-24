"use client";

import { useEffect, useMemo, useRef } from "react";
import { required, useGetIdentity, useGetList, useGetOne, useRecordContext } from "ra-core";
import { useController, useFormContext, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import {
  ComboboxQuery,
  CompactFormField,
  CompactComboboxQuery,
  CompactFormGrid,
  CompactFormSection,
  CompactSelectInput,
  CompactTextInput,
  FormField,
  ResponsableSelector,
} from "@/components/forms";
import { ReferenceInput } from "@/components/reference-input";
import { TextInput } from "@/components/text-input";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const CRMEventoFormContent = ({ lockedOportunidadId }: { lockedOportunidadId?: number }) => {
  const record = useRecordContext();
  const form = useFormContext();
  const { data: identity } = useGetIdentity();
  const { field: asignadoField } = useController({ name: "asignado_a_id" });
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

  const oportunidadLabel =
    (oportunidadLocked as any)?.titulo ??
    (oportunidadLocked as any)?.descripcion_estado ??
    (lockedOportunidadId ? `Oportunidad #${lockedOportunidadId}` : "");
  const contactoLabel =
    (contactoLocked as any)?.nombre_completo ??
    (contactoLocked as any)?.nombre ??
    (lockedContactoId ? `Contacto #${lockedContactoId}` : "");

  return (
    <CompactFormSection>
      <ReferenceInput
        source="tipo_id"
        reference="crm/catalogos/tipos-evento"
        label="Tipo de evento"
        perPage={200}
        filter={{ activo: true }}
      >
        <CompactSelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>

      {shouldLockFromOportunidad ? (
        <CompactFormGrid columns="two">
          <CompactFormField label="Contacto">
            <Input value={contactoLabel} readOnly className="w-full" />
          </CompactFormField>
          <CompactFormField label="Oportunidad">
            <Input value={oportunidadLabel} readOnly className="w-full" />
          </CompactFormField>
        </CompactFormGrid>
      ) : (
        <CompactFormGrid columns="two">
          <FormField
            label="Contacto"
            required
            error={form.formState.errors.contacto_id}
            className="space-y-1"
          >
            <CompactComboboxQuery
              resource="crm/contactos"
              labelField="nombre_completo"
              limit={200}
              source="contacto_id"
              placeholder="Selecciona un contacto"
              className="w-full justify-between"
            />
          </FormField>
          <FormField
            label="Oportunidad"
            error={form.formState.errors.oportunidad_id}
            className="space-y-1"
          >
            <CompactComboboxQuery
              resource="crm/oportunidades"
              labelField="titulo"
              limit={200}
              source="oportunidad_id"
              placeholder="Selecciona una oportunidad"
              className="w-full justify-between"
              filter={selectedContactoId ? { contacto_id: selectedContactoId, activo: true } : undefined}
              dependsOn={selectedContactoId ?? "all"}
              clearable
            />
          </FormField>
        </CompactFormGrid>
      )}

      <CompactFormGrid columns="two">
        <CompactTextInput
          source="fecha_evento"
          label="Fecha y hora"
          type="datetime-local"
          format={formatDateTimeInput}
          validate={required()}
        />
        <CompactTextInput source="titulo" label="Titulo" validate={required()} />
      </CompactFormGrid>

      <CompactTextInput source="descripcion" label="Descripcion" multiline rows={3} />

      <CompactFormField label="Asignado a">
        <ResponsableSelector
          includeTodos={false}
          value={asignadoField.value ? String(asignadoField.value) : ""}
          onValueChange={(value) => asignadoField.onChange(value ? Number(value) : null)}
        />
      </CompactFormField>

      <TextInput source="tipo_evento" label={false} className="hidden" />
      <TextInput source="motivo_id" label={false} className="hidden" />
      <TextInput source="contacto_id" label={false} className="hidden" />
      <TextInput source="oportunidad_id" label={false} className="hidden" />
      <TextInput source="estado_evento" label={false} className="hidden" defaultValue="1-pendiente" />
    </CompactFormSection>
  );
};

type CRMEventoFormProps = {
  defaultValues?: Record<string, unknown>;
  lockedOportunidadId?: number;
};

export const CRMEventoForm = ({ defaultValues, lockedOportunidadId }: CRMEventoFormProps) => (
  <SimpleForm defaultValues={defaultValues}>
    <CRMEventoFormContent lockedOportunidadId={lockedOportunidadId} />
  </SimpleForm>
);
