"use client";

import { Create } from "@/components/create";
import { NominaForm } from "./form";
import { normalizeNominaPayload } from "./model";
import { useLocation, useNavigate } from "react-router-dom";

export const NominaCreate = ({
  embedded = false,
  redirect = "list",
}: {
  embedded?: boolean;
  redirect?: string | false;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");
  const resolvedRedirect = returnTo ? false : redirect;

  return (
    <Create
      redirect={resolvedRedirect}
      title="Registrar empleado"
      transform={(data: any) => normalizeNominaPayload(data)}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={
        returnTo
          ? {
              onSuccess: () => navigate(returnTo),
            }
          : undefined
      }
    >
      <NominaForm />
    </Create>
  );
};
