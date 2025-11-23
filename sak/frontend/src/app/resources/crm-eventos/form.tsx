"use client";

import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { required, useRecordContext } from "ra-core";
import { CRM_EVENTO_ESTADO_CHOICES } from "./model";
import { FormLayout, FormSimpleSection } from "@/components/forms";
import type { CRMEvento } from "./model";

export const CRMEventoForm = () => (
  <SimpleForm warnWhenUnsavedChanges>
    <FormLayout
      sections={[
        {
          id: "datos-evento",
          title: "Datos del evento",
          children: <EventoSection />,
        },
        {
          id: "datos-oportunidad",
          title: "Datos de oportunidad asociada",
          defaultOpen: false,
          children: <OportunidadSection />,
        },
      ]}
    />
  </SimpleForm>
);

const EventoSection = () => (
  <FormSimpleSection>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ReferenceInput source="contacto_id" reference="crm/contactos" label="Contacto">
        <SelectInput optionText="nombre_completo" className="w-full" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source="asignado_a_id" reference="users" label="Asignado a">
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source="tipo_id" reference="crm/catalogos/tipos-evento" label="Tipo">
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source="motivo_id" reference="crm/catalogos/motivos-evento" label="Motivo">
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source="origen_lead_id" reference="crm/catalogos/origenes-lead" label="Origen del lead">
        <SelectInput optionText="nombre" emptyText="Sin origen" className="w-full" />
      </ReferenceInput>
      <TextInput
        source="fecha_evento"
        label="Fecha del evento"
        type="datetime-local"
        className="w-full"
        validate={required()}
      />
      <TextInput source="fecha_compromiso" label="Fecha compromiso" type="date" className="w-full" />
      <SelectInput
        source="estado_evento"
        label="Estado"
        choices={CRM_EVENTO_ESTADO_CHOICES}
        className="w-full"
        defaultValue="pendiente"
      />
    </div>
    <TextInput source="descripcion" label="Descripción" multiline className="w-full" validate={required()} />
    <TextInput source="proximo_paso" label="Próximo paso" multiline className="w-full" />
  </FormSimpleSection>
);

const OportunidadSection = () => {
  const record = useRecordContext<CRMEvento>();
  return (
    <FormSimpleSection>
      <ReferenceInput source="oportunidad_id" reference="crm/oportunidades" label="Oportunidad">
        <SelectInput optionText="id" emptyText="Sin vincular" className="w-full" />
      </ReferenceInput>
      {record?.oportunidad_id && (
        <p className="text-xs text-muted-foreground mt-2">
          Esta sección es informativa: el evento está vinculado a la oportunidad #{record.oportunidad_id}.
        </p>
      )}
    </FormSimpleSection>
  );
};
