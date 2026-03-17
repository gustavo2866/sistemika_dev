"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useGetIdentity, useNotify } from "ra-core";
import { useNavigate } from "react-router-dom";
import { useFormContext, useWatch } from "react-hook-form";

import {
  FormReferenceAutocomplete,
  FormText,
  FormTextarea,
  FormOrderToolbar,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";

import {
  CRM_MENSAJE_SALIDA_DEFAULTS,
  crmMensajeSalidaSchema,
  normalizeMensajeSalidaPayload,
  type CRMMensajeSalidaFormValues,
} from "./model";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

//#region Componentes auxiliares del formulario

// Sincroniza el responsable por defecto con el usuario autenticado.
const ResponsablePorDefecto = ({ defaultResponsableId }: { defaultResponsableId?: number }) => {
  const form = useFormContext<CRMMensajeSalidaFormValues>();
  const responsableId = useWatch({ control: form.control, name: "responsable_id" });

  useEffect(() => {
    if (!defaultResponsableId || responsableId) return;
    form.setValue("responsable_id", defaultResponsableId);
  }, [defaultResponsableId, responsableId, form]);

  return null;
};

// Renderiza los campos base para vincular contacto, oportunidad y responsable.
const CamposRelacionadosMensajeSalida = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormReferenceAutocomplete
      referenceProps={{ source: "contacto_id", reference: "crm/contactos" }}
      inputProps={{
        label: "Contacto",
        optionText: "nombre_completo",
        placeholder: "Selecciona un contacto",
      }}
      widthClass="w-full"
    />
    <FormReferenceAutocomplete
      referenceProps={{ source: "oportunidad_id", reference: "crm/oportunidades" }}
      inputProps={{
        label: "Oportunidad",
        optionText: (record?: any) =>
          record?.descripcion_estado
            ? `${record.id} - ${record.descripcion_estado}`
            : `Oportunidad #${record?.id}`,
        placeholder: "Selecciona una oportunidad",
      }}
      widthClass="w-full"
    />
    <FormReferenceAutocomplete
      referenceProps={{ source: "responsable_id", reference: "users" }}
      inputProps={{
        label: "Responsable",
        optionText: "nombre",
        placeholder: "Selecciona un responsable",
      }}
      widthClass="w-full md:col-span-2"
    />
  </div>
);

// Renderiza los campos auxiliares cuando se envia a un contacto nuevo.
const CamposNuevoContactoMensajeSalida = () => {
  const form = useFormContext<CRMMensajeSalidaFormValues>();
  const contactoId = useWatch({ control: form.control, name: "contacto_id" });

  if (contactoId) return null;

  return (
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="contacto_telefono"
        label="Telefono del contacto"
        widthClass="w-full"
        placeholder="+54911..."
      />
      <FormText
        source="contacto_nombre"
        label="Nombre del contacto"
        widthClass="w-full"
        placeholder="Nombre completo"
      />
    </div>
  );
};

// Renderiza el contenido del mensaje de salida a enviar.
const CamposContenidoMensajeSalida = () => (
  <div className="grid gap-2">
    <FormTextarea
      source="descripcion"
      label="Mensaje"
      rows={6}
      widthClass="w-full"
      placeholder="Escribi el contenido a enviar..."
    />
  </div>
);

// Muestra una ayuda breve sobre el flujo de envio.
const AyudaMensajeSalida = () => (
  <div className="rounded-md border border-muted/60 bg-muted/30 p-3 text-xs text-muted-foreground">
    Este flujo crea un mensaje de salida y dispara el envio por el canal configurado.
    Si el contacto no existe, podes completar telefono y nombre para generarlo.
  </div>
);

//#endregion Componentes auxiliares del formulario

//#region Formulario principal

// Renderiza el formulario de alta para mensajes salientes.
export const CRMMensajeSalidaForm = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity();

  const handleSubmit = async (values: CRMMensajeSalidaFormValues) => {
    const normalizedValues = normalizeMensajeSalidaPayload(values);
    const contactoId = normalizedValues.contacto_id;
    const contactoNombre = normalizedValues.contacto_nombre;
    const contactoTelefono = normalizedValues.contacto_telefono;
    const descripcion = normalizedValues.descripcion;

    if (!contactoId && (!contactoNombre || !contactoTelefono)) {
      notify("Completa el nombre y telefono del nuevo contacto.", { type: "warning" });
      return;
    }
    if (!descripcion) {
      notify("Completa el texto del mensaje.", { type: "warning" });
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        contenido: descripcion,
        canal: "whatsapp",
        responsable_id: normalizedValues.responsable_id ?? identity?.id,
      };

      if (contactoId) {
        payload.contacto_id = contactoId;
      } else {
        payload.contacto_nombre = contactoNombre;
        payload.contacto_referencia = contactoTelefono;
      }

      if (normalizedValues.oportunidad_id) {
        payload.oportunidad_id = normalizedValues.oportunidad_id;
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
    }
  };

  return (
    <SimpleForm<CRMMensajeSalidaFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(crmMensajeSalidaSchema) as any}
      defaultValues={CRM_MENSAJE_SALIDA_DEFAULTS}
      onSubmit={handleSubmit as any}
      toolbar={<FormOrderToolbar saveProps={{ label: "Enviar", variant: "secondary" }} />}
    >
      <ResponsablePorDefecto
        defaultResponsableId={typeof identity?.id === "number" ? identity.id : undefined}
      />
      <SectionBaseTemplate
        title="Relacion del mensaje"
        main={<CamposRelacionadosMensajeSalida />}
        optional={<AyudaMensajeSalida />}
        defaultOpen
      />
      <SectionBaseTemplate
        title="Nuevo contacto"
        main={<CamposNuevoContactoMensajeSalida />}
        defaultOpen
      />
      <SectionBaseTemplate
        title="Contenido"
        main={<CamposContenidoMensajeSalida />}
        defaultOpen
      />
    </SimpleForm>
  );
};

//#endregion Formulario principal
