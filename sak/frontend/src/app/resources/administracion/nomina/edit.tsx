"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { NominaForm } from "./form";
import { normalizeNominaPayload } from "./model";
import { useLocation, useNavigate } from "react-router-dom";

export const NominaEdit = ({
  embedded = false,
  id,
  redirect,
}: {
  embedded?: boolean;
  id?: string | number;
  redirect?: string | false;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const locationState = location.state as { returnTo?: string } | null;
  const returnTo = locationState?.returnTo ?? params.get("returnTo");
  const resolvedRedirect = returnTo ? false : redirect;

  return (
    <Edit
      id={id}
      redirect={resolvedRedirect}
      title="Editar empleado"
      mutationMode="pessimistic"
      transform={(data: any) => normalizeNominaPayload(data)}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={
        returnTo
          ? {
              onSuccess: () => navigate(returnTo, { replace: true }),
            }
          : undefined
      }
      actions={
        <div className="flex justify-end">
          <FormOrderDeleteButton />
        </div>
      }
    >
      <NominaForm />
    </Edit>
  );
};
