"use client";

import { useEffect, useState } from "react";
import { useGetIdentity, useNotify, required } from "ra-core";
import { useNavigate } from "react-router-dom";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { SaveButton } from "@/components/form";
import { CancelButton } from "@/components/cancel-button";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { useFormContext, useWatch } from "react-hook-form";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type FormValues = {
  responsable_id?: number;
  contacto_id?: number;
  contacto_nombre?: string;
  contacto_telefono?: string;
  descripcion?: string;
};

export const CRMMensajeSalidaForm = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: FormValues) => {
    if (submitting) return;
    const contactoId = values.contacto_id;
    const contactoNombre = values.contacto_nombre?.trim();
    const contactoTelefono = values.contacto_telefono?.trim();
    const descripcion = values.descripcion?.trim();

    if (!contactoId && (!contactoNombre || !contactoTelefono)) {
      notify("Completa el nombre y telefono del nuevo contacto.", { type: "warning" });
      return;
    }
    if (!descripcion) {
      notify("Completa el texto del mensaje.", { type: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        contenido: descripcion,
        canal: "whatsapp",
        responsable_id: identity?.id,
      };
      if (contactoId) {
        payload.contacto_id = contactoId;
      } else {
        payload.contacto_nombre = contactoNombre;
        payload.contacto_referencia = contactoTelefono;
      }

      const response = await fetch(`${API_URL}/crm/mensajes/acciones/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Error al enviar el mensaje (HTTP ${response.status})`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody?.detail || errorMessage;
        } catch {
          // ignore
        }
        throw new Error(errorMessage);
      }

      notify("Mensaje enviado", { type: "success" });
      navigate(-1);
    } catch (error: any) {
      notify(error?.message ?? "No se pudo enviar el mensaje", { type: "warning" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SimpleForm
      warnWhenUnsavedChanges
      onSubmit={handleSubmit}
      toolbar={
        <FormToolbar className="mt-3 flex justify-end">
          <div className="flex justify-end gap-2">
            <CancelButton />
            <SaveButton label="Enviar" />
          </div>
        </FormToolbar>
      }
    >
      <ResponsableField defaultResponsableId={typeof identity?.id === 'number' ? identity.id : undefined} />
      <ReferenceInput source="contacto_id" reference="crm/contactos" label="Contacto">
        <SelectInput optionText="nombre_completo" emptyText="Selecciona contacto" />
      </ReferenceInput>
      <NuevoContactoFields />
      <TextInput
        source="descripcion"
        label="Descripcion"
        multiline
        rows={4}
        className="w-full"
        validate={required()}
      />
    </SimpleForm>
  );
};

const ResponsableField = ({ defaultResponsableId }: { defaultResponsableId?: number }) => {
  const form = useFormContext();
  const responsableId = useWatch({ control: form.control, name: "responsable_id" });

  useEffect(() => {
    if (!defaultResponsableId || responsableId) return;
    form.setValue("responsable_id", defaultResponsableId);
  }, [defaultResponsableId, responsableId, form]);

  return (
    <ReferenceInput source="responsable_id" reference="users" label="Responsable">
      <SelectInput optionText="nombre" emptyText="Sin asignar" />
    </ReferenceInput>
  );
};

const NuevoContactoFields = () => {
  const form = useFormContext();
  const contactoId = useWatch({ control: form.control, name: "contacto_id" });
  const contactoNombre = useWatch({ control: form.control, name: "contacto_nombre" });
  const nombreMaxLength = 40;
  const compactFieldClass =
    "gap-1 [&_[data-slot=form-label]]:text-[9px] [&_[data-slot=form-label]]:uppercase " +
    "[&_[data-slot=form-label]]:tracking-wide [&_[data-slot=form-label]]:text-slate-500 " +
    "[&_[data-slot=form-label]]:whitespace-nowrap [&_[data-slot=input]]:h-7 " +
    "[&_[data-slot=input]]:text-xs [&_[data-slot=input]]:px-2 " +
    "[&_[data-slot=input]]:rounded-md";

  useEffect(() => {
    if (!contactoId) return;
    form.setValue("contacto_nombre", "");
    form.setValue("contacto_telefono", "");
  }, [contactoId, form]);

  if (contactoId) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-md border border-slate-200/70 bg-slate-50/70 p-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        Nuevo contacto
      </p>
      <div className="flex flex-nowrap gap-2">
        <TextInput
          source="contacto_telefono"
          label="Telefono"
          className={`${compactFieldClass} [&_[data-slot=input]]:w-[14ch]`}
        />
        <TextInput
          source="contacto_nombre"
          label="Nombre"
          className={`${compactFieldClass} [&_[data-slot=input]]:w-[18ch]`}
          helperText={`${(contactoNombre ?? "").length}/${nombreMaxLength}`}
          maxLength={nombreMaxLength}
        />
      </div>
    </div>
  );
};
