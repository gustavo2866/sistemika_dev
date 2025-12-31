"use client";

import { Target } from "lucide-react";
import { useNotify, useRecordContext, useRefresh } from "ra-core";
import { Edit } from "@/components/edit";
import { ResourceTitle } from "@/components/resource-title";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { SaveButton } from "@/components/form";
import { CancelButton } from "@/components/cancel-button";
import { Card } from "@/components/ui/card";
import type { CRMOportunidad } from "../crm-oportunidades/model";
import { AccionOportunidadHeader } from "./accion_header";
import { useLocation, useNavigate } from "react-router-dom";

export const CRMOportunidadAccionDescartar = () => {
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
      transform={() => ({ activo: false })}
      mutationOptions={{
        onSuccess: () => {
          notify("Oportunidad descartada exitosamente", { type: "success" });
          refresh();
          navigate(returnTo, { replace: true });
        },
      }}
      title={<ResourceTitle icon={Target} text="Descartar oportunidad" />}
    >
      <AccionDescartarContent returnTo={returnTo} />
    </Edit>
  );
};

export default CRMOportunidadAccionDescartar;

const AccionDescartarContent = ({ returnTo }: { returnTo: string }) => {
  const navigate = useNavigate();
  const record = useRecordContext<CRMOportunidad>();

  return (
    <div className="w-full max-w-3xl mr-auto ml-0">
      <SimpleForm
        className="w-full max-w-none"
        toolbar={
          <FormToolbar className="mt-4 rounded-2xl border border-border/50 bg-background/80 p-3 shadow-sm md:flex md:items-center md:justify-end md:py-3">
            <div className="flex justify-end gap-2">
              <CancelButton onClick={() => navigate(returnTo, { replace: true })} />
              <SaveButton label="Descartar" variant="destructive" alwaysEnable />
            </div>
          </FormToolbar>
        }
      >
        <div className="space-y-4">
          <AccionOportunidadHeader oportunidad={record} />
          <Card className="flex w-full flex-col gap-4 rounded-[30px] border border-border/40 bg-background/80 p-5 shadow-lg">
            <p className="text-sm text-muted-foreground">
              Esta accion marcara la oportunidad como inactiva. Podras reactivarla mas adelante si
              es necesario.
            </p>
          </Card>
        </div>
      </SimpleForm>
    </div>
  );
};
