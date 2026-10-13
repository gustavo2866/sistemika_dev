"use client";

import { DateField } from "@/components/date-field";
import { FormOrderEditButton } from "@/components/forms/form_order";
import { ReferenceField } from "@/components/reference-field";
import { SelectField } from "@/components/select-field";
import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { apiUrl } from "@/lib/dataProvider";
import { useRecordContext } from "ra-core";

import {
  parseNominaLicenciaDocumento,
  TIPO_NOVEDAD_CHOICES,
  type NominaLicencia,
  type NominaLicenciaDocumento,
} from "./model";

const NominaNombreField = () => {
  const record = useRecordContext<{ nombre?: string | null; apellido?: string | null }>();
  const nombre = [record?.apellido, record?.nombre]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");
  return <span>{nombre || "-"}</span>;
};

const DocumentosField = () => {
  const record = useRecordContext<NominaLicencia>();
  const documentos = (Array.isArray(record?.documentos) ? record.documentos : [])
    .map(parseNominaLicenciaDocumento)
    .filter(
      (documento): documento is NominaLicenciaDocumento => Boolean(documento),
    );

  if (!documentos.length) return <span>Sin documentos</span>;

  return (
    <div className="flex flex-col gap-1">
      {documentos.map((documento) => (
        <a
          key={documento.url}
          href={
            documento.url.startsWith("/")
              ? `${apiUrl}${documento.url}`
              : documento.url
          }
          target="_blank"
          rel="noreferrer"
          className="break-all text-primary underline-offset-4 hover:underline"
        >
          {documento.nombre}
        </a>
      ))}
    </div>
  );
};

export const NominaLicenciaShow = () => (
  <Show actions={<FormOrderEditButton />}>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <ReferenceField source="nomina_id" reference="nominas" label="Empleado">
        <NominaNombreField />
      </ReferenceField>
      <SelectField
        source="tipo_novedad"
        choices={TIPO_NOVEDAD_CHOICES}
      />
      <DateField source="fecha_desde" />
      <DateField source="fecha_hasta" />
      <TextField source="comentario" label="Comentario" />
      <DocumentosField />
      <DateField source="created_at" />
      <DateField source="updated_at" />
    </SimpleShowLayout>
  </Show>
);

export default NominaLicenciaShow;
