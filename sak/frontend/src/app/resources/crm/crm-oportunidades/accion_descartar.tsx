"use client";

import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useGetOne, useNotify, useRefresh } from "ra-core";
import { Target } from "lucide-react";

import { SimpleForm } from "@/components/forms/form_order/simple_form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccionOportunidadHeader } from "./accion_header";
import type { CRMOportunidad } from "./model";

export const CRMOportunidadAccionDescartar = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const stateRecord = (location.state as { record?: CRMOportunidad } | null)?.record ?? null;
  const oportunidadId = Number(id ?? stateRecord?.id);
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ??
    "/crm/oportunidades";
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shouldFetch = Number.isFinite(oportunidadId) && !stateRecord;
  const { data: oportunidad, isLoading } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadId },
    { enabled: shouldFetch },
  );

  const record = stateRecord ?? oportunidad ?? null;

  if (!Number.isFinite(oportunidadId) || (shouldFetch && isLoading)) {
    return null;
  }

  return (
    <AccionDescartarContent
      returnTo={returnTo}
      isSubmitting={isSubmitting}
      record={record}
      onConfirm={async (oportunidadId) => {
        if (!oportunidadId) {
          notify("Oportunidad no válida.", { type: "warning" });
          return;
        }
        setIsSubmitting(true);
        try {
          const token =
            typeof window !== "undefined"
              ? localStorage.getItem("auth_token")
              : null;
          const headers: HeadersInit = token
            ? { Authorization: `Bearer ${token}` }
            : {};
          const apiBaseUrl =
            process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
          const response = await fetch(
            `${apiBaseUrl}/crm/oportunidades/${oportunidadId}/descartar`,
            {
              method: "POST",
              headers,
            },
          );
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          notify("Oportunidad descartada exitosamente", { type: "success" });
          refresh();
          navigate(returnTo, { replace: true });
        } catch (error: any) {
          notify(
            error?.message ?? "No se pudo descartar la oportunidad.",
            { type: "warning" },
          );
        } finally {
          setIsSubmitting(false);
        }
      }}
    />
  );
};

export default CRMOportunidadAccionDescartar;

const AccionDescartarContent = ({
  returnTo,
  isSubmitting,
  record,
  onConfirm,
}: {
  returnTo: string;
  isSubmitting: boolean;
  record: CRMOportunidad | null;
  onConfirm: (oportunidadId?: number) => void;
}) => {
  const navigate = useNavigate();

  return (
    <Dialog
      open
      onOpenChange={(open) =>
        !open ? navigate(returnTo, { replace: true }) : null
      }
    >
      <DialogContent
        className="sm:max-w-sm"
        overlayClassName="!bg-transparent !backdrop-blur-0"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Descartar oportunidad
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs">
            Esta acción marcará la oportunidad como inactiva.
          </DialogDescription>
        </DialogHeader>
        <SimpleForm className="w-full" toolbar={null}>
          <div className="space-y-3">
            <AccionOportunidadHeader oportunidad={record} compact />
            <div className="rounded-md border border-border/70 bg-muted/10 p-3 text-[11px] sm:text-xs">
              <p className="text-[10px] text-muted-foreground sm:text-[11px]">
                Podrás reactivarla más adelante si es necesario.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(returnTo, { replace: true })}
              disabled={isSubmitting}
              className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSubmitting}
              className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
              onClick={() => onConfirm(record?.id)}
            >
              {isSubmitting ? "Descartando..." : "Descartar"}
            </Button>
          </DialogFooter>
        </SimpleForm>
      </DialogContent>
    </Dialog>
  );
};
