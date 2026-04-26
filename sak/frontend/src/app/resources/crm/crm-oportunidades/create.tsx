"use client";

import { Create } from "@/components/create";
import { Target } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  loadDashboardReturnMarker,
  saveDashboardReturnMarker,
} from "../crm-dashboard/return-state";
import { CRMOportunidadForm } from "./form";
import { CRMOportunidadBackButton } from "./navigation-title";

export const CRMOportunidadCreate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={false}
      title={
        <div className="flex items-center gap-2">
          <CRMOportunidadBackButton returnTo={returnTo ?? undefined} />
          <span className="inline-flex items-center gap-2">
            <Target className="h-4 w-4" />
            Crear Oportunidad
          </span>
        </div>
      }
      mutationOptions={{
        onSuccess: () => {
          if (returnTo) {
            const existingReturnMarker = loadDashboardReturnMarker(returnTo);
            saveDashboardReturnMarker(returnTo, {
              ...existingReturnMarker,
              savedAt: Date.now(),
              refreshAll: true,
            });
            navigate(returnTo);
            return;
          }
          navigate("/crm/oportunidades");
        },
      }}
    >
      <CRMOportunidadForm />
    </Create>
  );
};

export default CRMOportunidadCreate;
