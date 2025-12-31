"use client";

import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  required,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRedirect,
  useRefresh,
} from "ra-core";
import { Calendar } from "lucide-react";
import { Create } from "@/components/create";
import { ResourceTitle } from "@/components/resource-title";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { SaveButton } from "@/components/form";
import { CancelButton } from "@/components/cancel-button";
import { Card } from "@/components/ui/card";
import { AccionOportunidadHeader } from "./accion_header";

const normalizeId = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

export const CRMOportunidadAccionAgendar = () => {
  const { id } = useParams();
  const oportunidadId = Number(id);
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const redirect = useRedirect();
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const { identity } = useGetIdentity();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/crm/panel";

  const { data: oportunidad, isLoading } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadId },
    { enabled: Number.isFinite(oportunidadId) }
  );

  const defaultValues = useMemo(
    () => ({
      titulo: oportunidad?.titulo ? `Visita ${oportunidad.titulo}` : "",
      descripcion: "",
      tipo_evento_id: "",
      fecha: "",
      asignado_id: identity?.id ?? "",
    }),
    [oportunidad, identity]
  );

  if (!Number.isFinite(oportunidadId) || isLoading) {
    return null;
  }

  return (
    <Create
      resource="crm/eventos"
      redirect={false}
      mutationOptions={{
        onSuccess: async () => {
          try {
            await dataProvider.update("crm/oportunidades", {
              id: oportunidadId,
              data: { estado: "2-visita", fecha_estado: new Date().toISOString() },
              previousData: oportunidad,
            });
            notify("Visita agendada exitosamente", { type: "success" });
            refresh();
            navigate(returnTo);
          } catch (error: any) {
            notify(error.message || "Error al actualizar la oportunidad", { type: "error" });
          }
        },
        onError: (error: any) => {
          notify(error.message || "Error al agendar la visita", { type: "error" });
        },
      }}
      transform={(data) => ({
        titulo: (data as any).titulo,
        descripcion: (data as any).descripcion,
        tipo_id: normalizeId((data as any).tipo_evento_id),
        asignado_a_id: normalizeId((data as any).asignado_id),
        fecha_evento: (data as any).fecha,
        contacto_id: oportunidad?.contacto_id,
        oportunidad_id: oportunidadId,
        estado: 1,
      })}
      title={<ResourceTitle icon={Calendar} text="Agendar visita" />}
    >
      <div className="w-full max-w-3xl mr-auto ml-0">
        <SimpleForm
          key={oportunidadId}
          defaultValues={defaultValues}
          className="w-full max-w-none"
          toolbar={
            <FormToolbar className="mt-4 rounded-2xl border border-border/50 bg-background/80 p-3 shadow-sm md:flex md:items-center md:justify-end md:py-3">
              <div className="flex justify-end gap-2">
                <CancelButton onClick={() => navigate(returnTo)} />
                <SaveButton label="Agendar visita" />
              </div>
            </FormToolbar>
          }
        >
          <div className="space-y-4">
            <AccionOportunidadHeader oportunidad={oportunidad ?? null} />
            <Card className="flex w-full flex-col gap-5 rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-5 shadow-lg">
              <TextInput source="titulo" label="Titulo" className="w-full" validate={required()} />
              <ReferenceInput
                source="tipo_evento_id"
                reference="crm/catalogos/tipos-evento"
                label="Tipo"
              >
                <SelectInput optionText="nombre" emptyText="Seleccionar" validate={required()} />
              </ReferenceInput>
              <TextInput
                source="fecha"
                label="Fecha y hora"
                type="datetime-local"
                className="w-full"
                validate={required()}
              />
              <ReferenceInput source="asignado_id" reference="users" label="Asignado a">
                <SelectInput optionText="nombre" emptyText="Seleccionar" validate={required()} />
              </ReferenceInput>
              <TextInput
                source="descripcion"
                label="Descripcion"
                multiline
                className="w-full"
                placeholder="Notas adicionales de la visita"
              />
            </Card>
          </div>
        </SimpleForm>
      </div>
    </Create>
  );
};

export default CRMOportunidadAccionAgendar;
