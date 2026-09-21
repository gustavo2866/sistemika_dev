"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { useLocation, useNavigate } from "react-router-dom";
import { TarjaNominaForm } from "./form";
import {
  TARJA_NOMINA_DEFAULT,
  normalizeTarjaNominaPayload,
  type TarjaNominaFormValues,
} from "./model";

type TarjaNominaCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

export const TarjaNominaCreate = ({
  embedded = false,
  redirect,
}: TarjaNominaCreateProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const tarjaIdParam = params.get("tarja_id");
  const returnTo = params.get("returnTo");
  const nominaIdParam = params.get("nomina_id");
  const fechaDesdeParam = params.get("fecha_desde");
  const fechaHastaParam = params.get("fecha_hasta");
  const tarjaId = tarjaIdParam ? Number(tarjaIdParam) : undefined;
  const nominaId = nominaIdParam ? Number(nominaIdParam) : undefined;
  const defaultValues: TarjaNominaFormValues = {
    ...TARJA_NOMINA_DEFAULT,
    ...(Number.isFinite(tarjaId) && tarjaId ? { tarja_id: tarjaId } : {}),
    ...(Number.isFinite(nominaId) && nominaId ? { nomina_id: nominaId } : {}),
    ...(fechaDesdeParam ? { fecha_desde: fechaDesdeParam } : {}),
    ...(fechaHastaParam ? { fecha_hasta: fechaHastaParam } : {}),
    ...(fechaDesdeParam ? { tarja_fecha_desde: fechaDesdeParam } : {}),
    ...(fechaHastaParam ? { tarja_fecha_hasta: fechaHastaParam } : {}),
  };
  const lockReferences = Boolean(
    Number.isFinite(tarjaId) &&
      tarjaId,
  );
  const listParams = new URLSearchParams();
  if (Number.isFinite(tarjaId) && tarjaId) {
    listParams.set("filter", JSON.stringify({ tarja_id: tarjaId }));
  }
  if (returnTo) {
    listParams.set("returnTo", returnTo);
  }
  const listSearch = listParams.toString();
  const listUrl = listSearch ? `/tarja-nomina?${listSearch}` : "/tarja-nomina";
  const successUrl = returnTo || listUrl;

  return (
    <Create
      redirect={redirect ?? (embedded ? false : "list")}
      record={defaultValues}
      title="Crear nomina de tarja"
      className="max-w-3xl w-full"
      transform={(data: any) => normalizeTarjaNominaPayload(data)}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={
        returnTo || !redirect
          ? {
              onSuccess: () => {
                navigate(successUrl, { replace: true });
              },
            }
          : undefined
      }
    >
      <TarjaNominaForm defaultValues={defaultValues} lockReferences={lockReferences} />
    </Create>
  );
};
