"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required, useEditContext } from "ra-core";
import {
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormTextarea,
  FormOrderToolbar,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import {
  CRM_MENSAJE_CANAL_CHOICES,
  CRM_MENSAJE_DEFAULTS,
  CRM_MENSAJE_ESTADO_CHOICES,
  CRM_MENSAJE_PRIORIDAD_CHOICES,
  CRM_MENSAJE_TIPO_CHOICES,
  crmMensajeSchema,
  formatMensajeCanal,
  formatMensajeEstado,
  formatMensajePrioridad,
  formatMensajeTipo,
  type CRMMensaje,
  type CRMMensajeRecord,
  type CRMMensajeFormValues,
} from "./model";

//#region Componentes auxiliares del formulario

// Renderiza los campos principales del mensaje CRM.
const CamposPrincipalesMensaje = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormSelect
      source="tipo"
      label="Tipo"
      choices={CRM_MENSAJE_TIPO_CHOICES}
      optionText="name"
      optionValue="id"
      widthClass="w-full"
      validate={required()}
    />
    <FormSelect
      source="canal"
      label="Canal"
      choices={CRM_MENSAJE_CANAL_CHOICES}
      optionText="name"
      optionValue="id"
      widthClass="w-full"
      validate={required()}
    />
    <FormReferenceAutocomplete
      referenceProps={{ source: "contacto_id", reference: "crm/contactos" }}
      inputProps={{
        label: "Contacto",
        optionText: "nombre_completo",
        placeholder: "Selecciona un contacto",
      }}
      widthClass="w-full"
    />
    <FormText
      source="contacto_referencia"
      label="Referencia externa"
      widthClass="w-full"
      placeholder="Telefono, email o referencia"
    />
    <FormText
      source="contacto_nombre_propuesto"
      label="Nombre propuesto"
      widthClass="w-full"
    />
    <FormText
      source="fecha_mensaje"
      label="Fecha del mensaje"
      type="datetime-local"
      widthClass="w-full"
    />
    <FormText
      source="asunto"
      label="Asunto"
      widthClass="w-full md:col-span-2"
    />
    <FormTextarea
      source="contenido"
      label="Contenido"
      rows={5}
      widthClass="w-full md:col-span-2"
    />
    <FormText
      source="origen_externo_id"
      label="ID externo"
      widthClass="w-full md:col-span-2"
    />
  </div>
);

// Renderiza los campos de gestion y seguimiento del mensaje.
const CamposGestionMensaje = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormSelect
      source="estado"
      label="Estado"
      choices={CRM_MENSAJE_ESTADO_CHOICES}
      optionText="name"
      optionValue="id"
      widthClass="w-full"
      validate={required()}
    />
    <FormSelect
      source="prioridad"
      label="Prioridad"
      choices={CRM_MENSAJE_PRIORIDAD_CHOICES}
      optionText="name"
      optionValue="id"
      widthClass="w-full"
      validate={required()}
    />
    <FormReferenceAutocomplete
      referenceProps={{ source: "responsable_id", reference: "users" }}
      inputProps={{
        label: "Responsable",
        optionText: "nombre",
        placeholder: "Selecciona un responsable",
      }}
      widthClass="w-full"
    />
    <FormReferenceAutocomplete
      referenceProps={{ source: "evento_id", reference: "crm/crm-eventos" }}
      inputProps={{
        label: "Evento vinculado",
        optionText: "descripcion",
        placeholder: "Selecciona un evento",
      }}
      widthClass="w-full"
    />
  </div>
);

// Renderiza las referencias funcionales del mensaje dentro del CRM.
const CamposRelacionesMensaje = () => (
  <div className="grid gap-2 md:grid-cols-2">
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
      widthClass="w-full md:col-span-2"
    />
  </div>
);

// Muestra una ayuda breve sobre la administracion del mensaje.
const AyudaMensajeCRM = () => (
  <div className="rounded-md border border-muted/60 bg-muted/30 p-3 text-xs text-muted-foreground">
    Usa este formulario para corregir metadatos, reasignar responsables o vincular
    el mensaje con contactos, eventos y oportunidades existentes.
  </div>
);

// Resume el contexto actual del registro durante la edicion.
const ResumenContextoMensaje = () => {
  const { record } = useEditContext<CRMMensajeRecord>();
  if (!record) return null;

  const resumen = [
    formatMensajeTipo(record.tipo),
    formatMensajeCanal(record.canal),
    formatMensajeEstado(record.estado),
    formatMensajePrioridad(record.prioridad),
  ]
    .filter(Boolean)
    .join(" · ");

  return resumen ? (
    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {resumen}
    </span>
  ) : null;
};

//#endregion Componentes auxiliares del formulario

//#region Formulario principal

// Renderiza el formulario compartido por alta y edicion del recurso.
export const CRMMensajeForm = () => (
  <SimpleForm<CRMMensajeFormValues>
    className="w-full max-w-3xl"
    warnWhenUnsavedChanges
    resolver={zodResolver(crmMensajeSchema) as any}
    toolbar={<FormOrderToolbar saveProps={{ variant: "secondary" }} />}
    defaultValues={CRM_MENSAJE_DEFAULTS}
  >
    <SectionBaseTemplate
      title="Datos del mensaje"
      main={<CamposPrincipalesMensaje />}
      optional={<AyudaMensajeCRM />}
      defaultOpen
      headerSummary={<ResumenContextoMensaje />}
    />
    <SectionBaseTemplate
      title="Gestion CRM"
      main={<CamposGestionMensaje />}
      defaultOpen={false}
    />
    <SectionBaseTemplate
      title="Relaciones"
      main={<CamposRelacionesMensaje />}
      defaultOpen={false}
    />
  </SimpleForm>
);

//#endregion Formulario principal
