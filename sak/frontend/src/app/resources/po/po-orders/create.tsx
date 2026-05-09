"use client";

import { Create } from "@/components/create";
import { ClipboardList } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  loadDashboardReturnMarker,
  saveDashboardReturnMarker,
} from "../po-dashboard/return-state";
import { PoOrderForm } from "./form";
import { normalizePoOrderPayload } from "./model";
import { PoOrderBackButton } from "./navigation-title";

export const PoOrderCreate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={false}
      title={
        <div className="flex items-center gap-2">
          <PoOrderBackButton returnTo={returnTo ?? undefined} />
          <span className="inline-flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Crear Orden
          </span>
        </div>
      }
      transform={(data: any) => normalizePoOrderPayload(data)}
      mutationOptions={{
        onSuccess: () => {
          if (returnTo) {
            const existingReturnMarker = loadDashboardReturnMarker(returnTo);
            saveDashboardReturnMarker(returnTo, {
              ...(existingReturnMarker ?? {}),
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
