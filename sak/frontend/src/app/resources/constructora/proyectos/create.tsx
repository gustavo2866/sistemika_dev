"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { useLocation, useNavigate } from "react-router-dom";
import {
  loadDashboardReturnMarker,
  saveDashboardReturnMarker,
} from "../proy-dashboard/return-state";
import { ProyectoForm } from "./form";
import { ProyectoBackButton } from "./navigation-title";
import {
  getProyectoEstadoBadgeClass,
  getProyectoEstadoLabel,
  normalizeProyectoPayload,
} from "./model";

type ProyectoCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const ProyectoCreateTitle = ({ returnTo }: { returnTo?: string }) => (
  <div className="flex flex-wrap items-center gap-2">
    <ProyectoBackButton returnTo={returnTo} />
    <span>Crear proyecto</span>
    <Badge variant="secondary" className={getProyectoEstadoBadgeClass(undefined)}>
      {getProyectoEstadoLabel(undefined)}
    </Badge>
  </div>
);

export const ProyectoCreate = ({
  embedded = false,
  redirect,
}: ProyectoCreateProps = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={false}
      title={<ProyectoCreateTitle returnTo={returnTo ?? undefined} />}
      className="max-w-5xl w-full"
      transform={normalizeProyectoPayload}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={{
        onSuccess: () => {
          if (returnTo) {
            const existingReturnMarker = loadDashboardReturnMarker(returnTo);
            saveDashboardReturnMarker(returnTo, {
              ...existingReturnMarker,
              savedAt: Date.now(),
            });
            navigate(returnTo);
            return;
          }
          if (typeof redirect === "string") {
            navigate(redirect);
            return;
          }
          if (redirect === false || embedded) {
            return;
          }
          navigate("/proyectos");
        },
      }}
    >
      <ProyectoForm />
    </Create>
  );
};
