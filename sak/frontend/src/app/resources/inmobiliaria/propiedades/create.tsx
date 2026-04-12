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

export const PropiedadCreate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={false}
      title={<ResourceTitle icon={Home} text="Crear propiedad" />}
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
          navigate("/propiedades");
        },
      }}
    >
      <PropiedadForm />
    </Create>
  );
};
