"use client";

import { useEffect, useMemo } from "react";
import { required, useGetIdentity, useGetList, useRecordContext } from "ra-core";
import { useController, useFormContext, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import { ComboboxQuery, ResponsableSelector } from "@/components/forms";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { Label } from "@/components/ui/label";

const CRMEventoFormContent = () => {
  const record = useRecordContext();
  const form = useFormContext();
  const { data: identity } = useGetIdentity();
  const { field: asignadoField } = useController({ name: "asignado_a_id" });
  const isEdit = Boolean(record?.id);
  const descripcionValue = useWatch({ control: form.control, name: "descripcion" });
  const contactoIdRaw = useWatch({ control: form.control, name: "contacto_id" });

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
  const { data: contactosActivos = [] } = useGetList<any>("crm/gestion/contactos-activos", {
    pagination: { page: 1, perPage: 200 },
    filter: {},
    sort: { field: "nombre_completo", order: "ASC" },
  });

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
    if (selectedContacto?.oportunidad_id) {
      form.setValue("oportunidad_id", selectedContacto.oportunidad_id, { shouldDirty: true });
    } else if (!isEdit) {
      form.setValue("oportunidad_id", null, { shouldDirty: true });
    }
  }, [form, isEdit, selectedContacto]);

  return (
    <div className="space-y-4">
      <ReferenceInput
        source="tipo_id"
        reference="crm/catalogos/tipos-evento"
        label="Tipo de evento"
        perPage={200}
        filter={{ activo: true }}
      >
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Contacto</Label>
        <ComboboxQuery
          source="contacto_id"
          resource="crm/gestion/contactos-activos"
          labelField="nombre_completo"
          limit={200}
          placeholder="Selecciona un contacto"
          className="w-full"
          clearable
        />
      </div>
      <TextInput
        source="fecha_evento"
        label="Fecha y hora"
        type="datetime-local"
        className="w-full"
        validate={required()}
      />
      <TextInput source="titulo" label="Titulo" className="w-full" validate={required()} />
      <TextInput source="descripcion" label="Descripcion" multiline rows={3} className="w-full" />
      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Asignado a</Label>
        <ResponsableSelector
          includeTodos={false}
          value={asignadoField.value ? String(asignadoField.value) : ""}
          onValueChange={(value) => asignadoField.onChange(value ? Number(value) : null)}
        />
      </div>
      <TextInput source="tipo_evento" label={false} className="hidden" />
      <TextInput source="motivo_id" label={false} className="hidden" />
      <TextInput source="oportunidad_id" label={false} className="hidden" />
      <TextInput source="estado_evento" label={false} className="hidden" defaultValue="1-pendiente" />
    </div>
  );
};

type CRMEventoFormProps = {
  defaultValues?: Record<string, unknown>;
};

export const CRMEventoForm = ({ defaultValues }: CRMEventoFormProps) => (
  <SimpleForm defaultValues={defaultValues}>
    <CRMEventoFormContent />
  </SimpleForm>
);
