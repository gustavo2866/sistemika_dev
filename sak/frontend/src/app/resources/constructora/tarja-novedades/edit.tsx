"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { useLocation, useNavigate } from "react-router-dom";
import { TarjaNovedadForm } from "./form";
import { normalizeTarjaNovedadPayload } from "./model";

type TarjaNovedadEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const TarjaNovedadEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const TarjaNovedadEdit = ({
  embedded = false,
  id,
  redirect,
}: TarjaNovedadEditProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Edit
      id={id}
      redirect={redirect ?? (embedded ? false : "list")}
      title="Editar novedad de tarja"
      className="max-w-3xl w-full"
      mutationMode="pessimistic"
      transform={(data: any) => normalizeTarjaNovedadPayload(data)}
      actions={<TarjaNovedadEditActions />}
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
      <TarjaNovedadForm />
    </Edit>
  );
};
