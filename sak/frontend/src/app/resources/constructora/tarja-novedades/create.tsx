"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { useLocation, useNavigate } from "react-router-dom";
import { TarjaNovedadForm } from "./form";
import {
  TARJA_NOVEDAD_DEFAULT,
  normalizeTarjaNovedadPayload,
  type TarjaNovedadFormValues,
} from "./model";

type TarjaNovedadCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

export const TarjaNovedadCreate = ({
  embedded = false,
  redirect,
}: TarjaNovedadCreateProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const tarjaIdParam = params.get("tarja_id");
  const returnTo = params.get("returnTo");
  const nominaIdParam = params.get("nomina_id");
  const tarjaId = tarjaIdParam ? Number(tarjaIdParam) : undefined;
  const nominaId = nominaIdParam ? Number(nominaIdParam) : undefined;
  const defaultValues: TarjaNovedadFormValues = {
    ...TARJA_NOVEDAD_DEFAULT,
    ...(Number.isFinite(tarjaId) && tarjaId ? { tarja_id: tarjaId } : {}),
    ...(Number.isFinite(nominaId) && nominaId ? { nomina_id: nominaId } : {}),
  };
  const lockReferences = Boolean(
    Number.isFinite(tarjaId) &&
      tarjaId,
  );

  return (
    <Create
      redirect={redirect ?? (embedded ? false : "list")}
      record={defaultValues}
      title="Crear novedad de tarja"
      className="max-w-3xl w-full"
      transform={(data: any) => normalizeTarjaNovedadPayload(data)}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={
        redirect
          ? undefined
          : {
              onSuccess: () => {
                if (returnTo) {
                  navigate(returnTo, { replace: true });
                  return;
                }
                navigate("/tarja-novedades", { replace: true });
              },
            }
      }
    >
      <TarjaNovedadForm defaultValues={defaultValues} lockReferences={lockReferences} />
    </Create>
  );
};
