"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
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
  type ProyectoRecord,
} from "./model";

type ProyectoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const ProyectoEditTitle = () => {
  const { record } = useEditContext<ProyectoRecord>();
  if (!record) return "Editar proyecto";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ProyectoBackButton />
      <span>Editar proyecto</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge variant="secondary" className={getProyectoEstadoBadgeClass(record.estado)}>
        {getProyectoEstadoLabel(record.estado)}
      </Badge>
    </div>
  );
};

const ProyectoEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const ProyectoEdit = ({
  embedded = false,
  id,
  redirect,
}: ProyectoEditProps = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Edit
      id={id}
      redirect={false}
      mutationMode="pessimistic"
      title={<ProyectoEditTitle />}
      className="max-w-5xl w-full"
      actions={<ProyectoEditActions />}
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
            navigate(returnTo, { replace: true });
            return;
          }
          if (typeof redirect === "string") {
            navigate(redirect, { replace: true });
            return;
          }
          if (redirect === false || embedded) {
            return;
          }
          navigate("/proyectos", { replace: true });
        },
      }}
    >
      <ProyectoForm />
    </Edit>
  );
};
