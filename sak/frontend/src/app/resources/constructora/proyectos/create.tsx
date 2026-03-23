"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { ProyectoForm } from "./form";
import {
  getProyectoEstadoBadgeClass,
  getProyectoEstadoLabel,
  normalizeProyectoPayload,
} from "./model";

type ProyectoCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const ProyectoCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear proyecto</span>
    <Badge variant="secondary" className={getProyectoEstadoBadgeClass(undefined)}>
      {getProyectoEstadoLabel(undefined)}
    </Badge>
  </div>
);

export const ProyectoCreate = ({
  embedded = false,
  redirect,
}: ProyectoCreateProps = {}) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<ProyectoCreateTitle />}
    className="max-w-5xl w-full"
    transform={normalizeProyectoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ProyectoForm />
  </Create>
);
