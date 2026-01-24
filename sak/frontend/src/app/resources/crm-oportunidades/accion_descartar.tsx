"use client";

import { Target } from "lucide-react";
import { useNotify, useRecordContext, useRefresh } from "ra-core";
import { Edit } from "@/components/edit";
import { ResourceTitle } from "@/components/resource-title";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { CancelButton } from "@/components/cancel-button";
import { Card } from "@/components/ui/card";
import type { CRMOportunidad } from "./model";
import { AccionOportunidadHeader } from "./accion_header";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const CRMOportunidadAccionDescartar = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/crm/oportunidades";
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Edit
      resource="crm/oportunidades"
      redirect={false}
      actions={false}
      title={<ResourceTitle icon={Target} text="Descartar oportunidad" />}
    >
      <AccionDescartarContent
        returnTo={returnTo}
        isSubmitting={isSubmitting}
        onConfirm={async (oportunidadId) => {
          if (!oportunidadId) {
            notify("Oportunidad no válida.", { type: "warning" });
            return;
          }
          setIsSubmitting(true);
          try {
            const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
            const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
            const response = await fetch(`${apiBaseUrl}/crm/oportunidades/${oportunidadId}/descartar`, {
              method: "POST",
              headers,
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            notify("Oportunidad descartada exitosamente", { type: "success" });
            refresh();
            navigate(returnTo, { replace: true });
          } catch (error: any) {
            notify(error?.message ?? "No se pudo descartar la oportunidad.", { type: "warning" });
          } finally {
            setIsSubmitting(false);
          }
        }}
      />
    </Edit>
  );
};

export default CRMOportunidadAccionDescartar;

const AccionDescartarContent = ({
  returnTo,
  isSubmitting,
  onConfirm,
}: {
  returnTo: string;
  isSubmitting: boolean;
  onConfirm: (oportunidadId?: number) => void;
}) => {
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
              <Button
                type="button"
                variant="destructive"
                disabled={isSubmitting}
                onClick={() => onConfirm(record?.id)}
              >
                {isSubmitting ? "Descartando..." : "Descartar"}
              </Button>
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


