"use client";

import { Create } from "@/components/create";
import { ResourceTitle } from "@/components/resource-title";
import { Home } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  loadDashboardReturnMarker,
  saveDashboardReturnMarker,
} from "../propiedades-dashboard/return-state";

import { PropiedadForm } from "./form";
import { PropiedadBackButton } from "./navigation-title";

export const PropiedadCreate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={false}
      title={
        <div className="flex items-center gap-2">
          <PropiedadBackButton returnTo={returnTo ?? undefined} />
          <ResourceTitle icon={Home} text="Crear propiedad" />
        </div>
      }
      mutationOptions={{
        onSuccess: (data) => {
          const createdId = data?.id;

          if (returnTo) {
            const existingReturnMarker = loadDashboardReturnMarker(returnTo);
            saveDashboardReturnMarker(returnTo, {
              ...existingReturnMarker,
              savedAt: Date.now(),
              propiedadId: createdId ?? existingReturnMarker?.propiedadId,
              refreshAll: true,
            });
          }

          if (createdId != null) {
            const nextParams = new URLSearchParams();
            if (returnTo) {
              nextParams.set("returnTo", returnTo);
            }
            const nextSearch = nextParams.toString();
            navigate(`/propiedades/${createdId}${nextSearch ? `?${nextSearch}` : ""}`, {
              replace: true,
            });
            return;
          }

          if (returnTo) {
            navigate(returnTo, { replace: true });
            return;
          }

          navigate("/propiedades", { replace: true });
        },
      }}
    >
      <PropiedadForm mode="create" />
    </Create>
  );
};
