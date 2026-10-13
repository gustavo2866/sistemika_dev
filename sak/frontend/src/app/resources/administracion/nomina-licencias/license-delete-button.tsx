"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  type RedirectionSideEffect,
  useDataProvider,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
} from "ra-core";

import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";

import { NominaLicenciaImpactContent } from "./impact-confirmation";
import {
  validateNominaLicenciaDelete,
  type CoberturaLicenciaResponse,
  type NominaLicencia,
} from "./model";

export const NominaLicenciaDeleteButton = ({
  redirect = "list",
}: {
  redirect?: RedirectionSideEffect;
}) => {
  const record = useRecordContext<NominaLicencia>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const redirectTo = useRedirect();
  const refresh = useRefresh();
  const [validacion, setValidacion] =
    useState<CoberturaLicenciaResponse | null>(null);
  const [loading, setLoading] = useState(false);

  if (!record?.id) return null;

  const handlePreview = async () => {
    setLoading(true);
    try {
      setValidacion(await validateNominaLicenciaDelete(Number(record.id)));
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "No se pudo validar la eliminación",
        { type: "warning" },
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (validacion?.estado === "bloqueada") return;
    setLoading(true);
    try {
      await dataProvider.delete("nomina-licencias", {
        id: record.id,
        previousData: record,
      });
      notify("Licencia eliminada y partes diarios resincronizados", {
        type: "info",
      });
      setValidacion(null);
      if (redirect === false) {
        refresh();
      } else {
        redirectTo(redirect, "nomina-licencias", record.id, record);
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "No se pudo eliminar la licencia",
        { type: "warning" },
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => void handlePreview()}
        className="cursor-pointer border-destructive! text-destructive! hover:bg-destructive/10!"
      >
        <Trash2 className="size-3 sm:size-4" />
        Eliminar
      </Button>
      <Confirm
        isOpen={Boolean(validacion)}
        onClose={() => setValidacion(null)}
        onConfirm={() => void handleDelete()}
        title={
          validacion?.estado === "bloqueada"
            ? "Licencia bloqueada por tarjas cerradas"
            : "Confirmar eliminación de licencia"
        }
        content={
          validacion ? (
            <NominaLicenciaImpactContent
              operacion="eliminar"
              validacion={validacion}
            />
          ) : null
        }
        confirm="Eliminar y sincronizar"
        cancel={validacion?.estado === "bloqueada" ? "Cerrar" : undefined}
        confirmColor="warning"
        confirmDisabled={validacion?.estado === "bloqueada"}
        loading={loading}
      />
    </>
  );
};
