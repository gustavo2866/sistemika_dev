"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { useNotify, useRedirect } from "ra-core";
import { useState } from "react";

import {
  NominaLicenciaForm,
  uploadNominaLicenciaDocumento,
  type NominaLicenciaPendingDocumento,
} from "./form";

type NominaLicenciaCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const NominaLicenciaCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear licencia de nómina</span>
    <Badge variant="secondary" className="text-[11px]">
      Nueva
    </Badge>
  </div>
);

export const NominaLicenciaCreate = ({
  embedded = false,
  redirect,
}: NominaLicenciaCreateProps) => {
  const notify = useNotify();
  const redirectTo = useRedirect();
  const [pendingDocumentos, setPendingDocumentos] = useState<
    NominaLicenciaPendingDocumento[]
  >([]);
  const destination = redirect ?? (embedded ? false : "list");

  const handleSuccess = async (record: { id: number | string }) => {
    const results = await Promise.allSettled(
      pendingDocumentos.map((documento) =>
        uploadNominaLicenciaDocumento(Number(record.id), documento),
      ),
    );
    const failedCount = results.filter(
      (result) => result.status === "rejected",
    ).length;

    if (failedCount) {
      notify(
        `Licencia creada, pero ${failedCount} documento${failedCount === 1 ? "" : "s"} no se pudo${failedCount === 1 ? "" : "ieron"} subir`,
        { type: "warning" },
      );
      redirectTo("edit", "nomina-licencias", record.id, record);
      return;
    }

    notify(
      pendingDocumentos.length
        ? "Licencia creada y documentos subidos"
        : "Licencia creada",
      { type: "info" },
    );
    setPendingDocumentos([]);
    redirectTo(destination, "nomina-licencias", record.id, record);
  };

  return (
    <Create
      redirect={destination}
      title={<NominaLicenciaCreateTitle />}
      className="max-w-3xl w-full"
      mutationOptions={{ onSuccess: handleSuccess }}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
    >
      <NominaLicenciaForm
        pendingDocumentos={pendingDocumentos}
        onPendingDocumentosChange={setPendingDocumentos}
      />
    </Create>
  );
};
