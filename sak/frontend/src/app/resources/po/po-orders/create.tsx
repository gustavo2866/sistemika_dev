"use client";

import { Create } from "@/components/create";
import { ClipboardList } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { saveDashboardReturnMarker } from "../po-dashboard/return-state";
import { PoOrderForm } from "./form";
import { normalizePoOrderPayload } from "./model";

export const PoOrderCreate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={false}
      title={
        <span className="inline-flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Crear Orden
        </span>
      }
      transform={(data: any) => normalizePoOrderPayload(data)}
      mutationOptions={{
        onSuccess: () => {
          if (returnTo) {
            saveDashboardReturnMarker(returnTo, {
              savedAt: Date.now(),
              refreshAll: true,
            });
            navigate(returnTo);
            return;
          }
          navigate("/po-orders");
        },
      }}
    >
      <PoOrderForm />
    </Create>
  );
};
