"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { useLocation, useNavigate } from "react-router-dom";
import { TarjaNominaForm } from "./form";
import { normalizeTarjaNominaPayload } from "./model";

type TarjaNominaEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const TarjaNominaEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const TarjaNominaEdit = ({
  embedded = false,
  id,
  redirect,
}: TarjaNominaEditProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Edit
      id={id}
      redirect={redirect ?? (embedded ? false : "list")}
      title="Editar nomina de tarja"
      className="max-w-3xl w-full"
      mutationMode="pessimistic"
      transform={(data: any) => normalizeTarjaNominaPayload(data)}
      actions={<TarjaNominaEditActions />}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={
        returnTo || !redirect
          ? {
              onSuccess: () => {
                if (returnTo) {
                  navigate(returnTo, { replace: true });
                  return;
                }
                navigate("/tarja-nomina", { replace: true });
              },
            }
          : undefined
      }
    >
      <TarjaNominaForm />
    </Edit>
  );
};
