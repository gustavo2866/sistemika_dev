"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { BooleanInput } from "@/components/boolean-input";
import { FormLayout, FormSimpleSection } from "@/components/forms";
import { required } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { useRecordContext } from "ra-core";
import type { CRMMensaje } from "./model";
import {
  CRM_MENSAJE_TIPO_CHOICES,
  CRM_MENSAJE_CANAL_CHOICES,
  CRM_MENSAJE_ESTADO_CHOICES,
  CRM_MENSAJE_PRIORIDAD_CHOICES,
  formatMensajeCanal,
  formatMensajeEstado,
  formatMensajeTipo,
  formatMensajePrioridad,
} from "./model";

export const CRMMensajeForm = () => (
  <SimpleForm warnWhenUnsavedChanges>
    <CRMMensajeSections />
  </SimpleForm>
);

const CRMMensajeSections = () => {
  const record = useRecordContext<CRMMensaje>();
  const form = useFormContext();
  const control = form.control;
  const isEditMode = Boolean(record?.id);

  const tipoWatch = useWatch({ control, name: "tipo" });
  const canalWatch = useWatch({ control, name: "canal" });
  const contactoWatch = useWatch({ control, name: "contacto_id" });
  const asuntoWatch = useWatch({ control, name: "asunto" });
  const estadoWatch = useWatch({ control, name: "estado" });
  const prioridadWatch = useWatch({ control, name: "prioridad" });
  const responsableWatch = useWatch({ control, name: "responsable_id" });
  const oportunidadWatch = useWatch({ control, name: "oportunidad_id" });
  const eventoWatch = useWatch({ control, name: "evento_id" });
  const oportunidadGenerarWatch = useWatch({ control, name: "oportunidad_generar" });

  const contactoLabel =
    record?.contacto?.nombre_completo ||
    (contactoWatch ? `Contacto #${contactoWatch}` : record?.contacto_referencia) ||
    "Sin contacto";

  const detalleSubtitle = [
    formatMensajeTipo(tipoWatch ?? (record?.tipo as any)),
    formatMensajeCanal(canalWatch ?? (record?.canal as any)),
    contactoLabel,
    asuntoWatch || record?.asunto,
  ]
    .filter(Boolean)
    .join(" - ");

  const gestionSubtitle = [
    formatMensajeEstado(estadoWatch ?? (record?.estado as any)),
    formatMensajePrioridad(prioridadWatch ?? (record?.prioridad as any)),
    responsableWatch
      ? `Resp. #${responsableWatch}`
      : record?.responsable?.nombre && `Resp. ${record.responsable.nombre}`,
  ]
    .filter(Boolean)
    .join(" - ");

  const relacionesSubtitle = [
    oportunidadWatch
      ? `Op #${oportunidadWatch}`
      : record?.oportunidad?.id && `Op #${record.oportunidad.id}`,
    eventoWatch ? `Evento #${eventoWatch}` : record?.evento_id && `Evento #${record.evento_id}`,
    (oportunidadGenerarWatch ?? record?.oportunidad_generar) ? "Generar oportunidad" : null,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <FormLayout
      sections={[
        {
          id: "datos-mensaje",
          title: "Datos del mensaje",
          subtitle: detalleSubtitle || "Definí el canal, tipo y contenido recibido.",
          defaultOpen: !isEditMode,
          children: (
            <FormSimpleSection className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectInput
                  source="tipo"
                  label="Tipo"
                  choices={CRM_MENSAJE_TIPO_CHOICES}
                  className="w-full"
                  validate={required()}
                  defaultValue="entrada"
                />
                <SelectInput
                  source="canal"
                  label="Canal"
                  choices={CRM_MENSAJE_CANAL_CHOICES}
                  className="w-full"
                  validate={required()}
                  defaultValue="whatsapp"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <ReferenceInput
                  source="contacto_id"
                  reference="crm/contactos"
                  label="Contacto"
                >
                  <SelectInput optionText="nombre_completo" emptyText="Sin asignar" className="w-full" />
                </ReferenceInput>
                <TextInput
                  source="contacto_referencia"
                  label="Referencia externa (tel/email)"
                  className="w-full"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  source="contacto_nombre_propuesto"
                  label="Nombre propuesto"
                  className="w-full"
                />
                <TextInput source="fecha_mensaje" label="Fecha" type="datetime-local" className="w-full" />
              </div>
              <TextInput source="asunto" label="Asunto" className="w-full" />
              <TextInput
                source="contenido"
                label="Contenido"
                multiline
                rows={4}
                className="w-full"
                helperText="Resumen del mensaje recibido o a enviar."
              />
              <TextInput
                source="origen_externo_id"
                label="ID externo"
                className="w-full"
                helperText="Identificador provisto por el canal (opcional)."
              />
            </FormSimpleSection>
          ),
        },
        {
          id: "gestion-crm",
          title: "Gestión CRM",
          subtitle: gestionSubtitle || "Actualizá estado, prioridad y responsable.",
          defaultOpen: false,
          children: (
            <FormSimpleSection className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectInput
                  source="estado"
                  label="Estado"
                  choices={CRM_MENSAJE_ESTADO_CHOICES}
                  className="w-full"
                  validate={required()}
                  defaultValue="nuevo"
                />
                <SelectInput
                  source="prioridad"
                  label="Prioridad"
                  choices={CRM_MENSAJE_PRIORIDAD_CHOICES}
                  className="w-full"
                  validate={required()}
                  defaultValue="media"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <ReferenceInput
                  source="responsable_id"
                  reference="users"
                  label="Responsable"
                >
                  <SelectInput optionText="nombre" emptyText="Sin asignar" className="w-full" />
                </ReferenceInput>
                <ReferenceInput source="evento_id" reference="crm/eventos" label="Evento vinculado">
                  <SelectInput optionText="descripcion" emptyText="Sin evento" className="w-full" />
                </ReferenceInput>
              </div>
            </FormSimpleSection>
          ),
        },
        {
          id: "relaciones",
          title: "Relaciones",
          subtitle: relacionesSubtitle || "Asociá oportunidades y automatizá acciones.",
          defaultOpen: false,
          children: (
            <FormSimpleSection className="space-y-5">
              <ReferenceInput
                source="oportunidad_id"
                reference="crm/oportunidades"
                label="Oportunidad"
              >
                <SelectInput
                  optionText={(record) =>
                    record?.descripcion_estado
                      ? `${record.id} - ${record.descripcion_estado}`
                      : `Oportunidad #${record?.id}`
                  }
                  emptyText="Sin asignar"
                  className="w-full"
                />
              </ReferenceInput>
              <BooleanInput
                source="oportunidad_generar"
                label="Generar oportunidad desde este mensaje"
                helperText="Se analizará el mensaje para crear una oportunidad en caso necesario."
              />
            </FormSimpleSection>
          ),
        },
      ]}
    />
  );
};
