"use client";

import { Target } from "lucide-react";
import { required, useNotify, useRecordContext, useRefresh } from "ra-core";
import { Edit } from "@/components/edit";
import { ResourceTitle } from "@/components/resource-title";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { SaveButton } from "@/components/form";
import { CancelButton } from "@/components/cancel-button";
import { Card } from "@/components/ui/card";
import type { CRMOportunidad } from "../crm-oportunidades/model";
import { AccionOportunidadHeader } from "./accion_header";
import { useLocation, useNavigate } from "react-router-dom";

const normalizeId = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

export const CRMOportunidadAccionAceptar = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/crm/panel";

  return (
    <Edit
      resource="crm/oportunidades"
      redirect={false}
      mutationMode="pessimistic"
      actions={false}
      transform={(data) => ({
        ...data,
        estado: "1-abierta",
        fecha_estado: new Date().toISOString(),
        tipo_operacion_id: normalizeId((data as any).tipo_operacion_id),
        tipo_propiedad_id: normalizeId((data as any).tipo_propiedad_id),
        emprendimiento_id: normalizeId((data as any).emprendimiento_id),
      })}
      mutationOptions={{
        onSuccess: () => {
          notify("Oportunidad confirmada y movida a Abierta", { type: "success" });
          refresh();
          navigate(returnTo);
        },
      }}
      title={<ResourceTitle icon={Target} text="Confirmar oportunidad" />}
    >
      <AccionAceptarContent returnTo={returnTo} />
    </Edit>
  );
};

export default CRMOportunidadAccionAceptar;

const AccionAceptarContent = ({ returnTo }: { returnTo: string }) => {
  const navigate = useNavigate();
  const record = useRecordContext<CRMOportunidad>();

  return (
    <div className="w-full max-w-3xl mr-auto ml-0">
      <SimpleForm
        className="w-full max-w-none"
        toolbar={
          <FormToolbar className="mt-4 rounded-2xl border border-border/50 bg-background/80 p-3 shadow-sm md:flex md:items-center md:justify-end md:py-3">
            <div className="flex justify-end gap-2">
              <CancelButton className="h-8 px-3 text-xs" onClick={() => navigate(returnTo)} />
              <SaveButton label="Confirmar" className="h-8 px-3 text-xs" />
            </div>
          </FormToolbar>
        }
      >
        <div className="space-y-4">
          <AccionOportunidadHeader oportunidad={record} />
          <Card className="flex w-full flex-col gap-4 rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-5 text-sm shadow-lg [&_label]:!text-[10px] [&_label]:uppercase [&_label]:tracking-[0.25em] [&_[data-slot=form-label]]:!text-[10px] [&_[data-slot=form-label]]:uppercase [&_[data-slot=form-label]]:tracking-[0.25em] [&_input]:!h-8 [&_input]:!px-2 [&_input]:!text-xs [&_[data-slot=input]]:!h-8 [&_[data-slot=input]]:!px-2 [&_[data-slot=input]]:!text-xs [&_textarea]:!min-h-12 [&_textarea]:!px-2 [&_textarea]:!py-2 [&_textarea]:!text-xs [&_[data-slot=textarea]]:!min-h-12 [&_[data-slot=textarea]]:!px-2 [&_[data-slot=textarea]]:!py-2 [&_[data-slot=textarea]]:!text-xs [&_[data-slot=select-trigger]]:!h-8 [&_[data-slot=select-trigger]]:!px-2 [&_[data-slot=select-trigger]]:!text-xs">
            <TextInput source="titulo" label="Titulo" className="w-full" validate={required()} />
            <ReferenceInput
              source="tipo_operacion_id"
              reference="crm/catalogos/tipos-operacion"
              label="Tipo de operacion"
            >
              <SelectInput optionText="nombre" emptyText="Seleccionar" validate={required()} />
            </ReferenceInput>
            <ReferenceInput
              source="tipo_propiedad_id"
              reference="tipos-propiedad"
              label="Tipo de propiedad"
            >
              <SelectInput optionText="nombre" emptyText="Seleccionar" validate={required()} />
            </ReferenceInput>
            <ReferenceInput
              source="emprendimiento_id"
              reference="emprendimientos"
              label="Emprendimiento"
            >
              <SelectInput optionText="nombre" emptyText="Seleccionar" />
            </ReferenceInput>
            <TextInput
              source="descripcion_estado"
              label="Descripcion"
              multiline
              className="w-full"
            />
          </Card>
        </div>
      </SimpleForm>
    </div>
  );
};
