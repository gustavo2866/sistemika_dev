"use client";

import { Target } from "lucide-react";
import { required, useNotify, useRecordContext, useRefresh } from "ra-core";
import { Edit } from "@/components/edit";
import { ResourceTitle } from "@/components/resource-title";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { SaveButton } from "@/components/form";
import { CancelButton } from "@/components/cancel-button";
import { Card } from "@/components/ui/card";
import type { CRMOportunidad } from "./model";
import { AccionOportunidadHeader } from "./accion_header";
import { useLocation, useNavigate } from "react-router-dom";

const normalizeId = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

export const CRMOportunidadAccionCerrar = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/crm/oportunidades";

  return (
    <Edit
      resource="crm/oportunidades"
      redirect={false}
      mutationMode="pessimistic"
      actions={false}
      transform={(data) => ({
        ...data,
        estado: "6-perdida",
        fecha_estado: new Date().toISOString(),
        perder_motivo_id: normalizeId((data as any).perder_motivo_id),
        perder_nota: (data as any).perder_nota?.trim() || null,
      })}
      mutationOptions={{
        onSuccess: () => {
          notify("Oportunidad cerrada como perdida", { type: "success" });
          refresh();
          navigate(returnTo);
        },
      }}
      title={<ResourceTitle icon={Target} text="Cerrar oportunidad" />}
    >
      <AccionCerrarContent returnTo={returnTo} />
    </Edit>
  );
};

export default CRMOportunidadAccionCerrar;

const AccionCerrarContent = ({ returnTo }: { returnTo: string }) => {
  const navigate = useNavigate();
  const record = useRecordContext<CRMOportunidad>();

  return (
    <div className="w-full max-w-3xl mr-auto ml-0">
      <SimpleForm
        className="w-full max-w-none"
        toolbar={
          <FormToolbar className="mt-4 rounded-2xl border border-border/50 bg-background/80 p-3 shadow-sm md:flex md:items-center md:justify-end md:py-3">
            <div className="flex justify-end gap-2">
              <CancelButton onClick={() => navigate(returnTo)} />
              <SaveButton label="Cerrar oportunidad" variant="destructive" />
            </div>
          </FormToolbar>
        }
      >
        <div className="space-y-4">
          <AccionOportunidadHeader oportunidad={record} />
          <Card className="flex w-full flex-col gap-5 rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-5 shadow-lg">
            <ReferenceInput
              source="perder_motivo_id"
              reference="crm/catalogos/motivos-perdida"
              label="Motivo"
            >
              <SelectInput optionText="nombre" emptyText="Seleccionar" validate={required()} />
            </ReferenceInput>
            <TextInput
              source="perder_nota"
              label="Notas"
              multiline
              className="w-full"
              placeholder="Informacion adicional (opcional)"
            />
          </Card>
        </div>
      </SimpleForm>
    </div>
  );
};


