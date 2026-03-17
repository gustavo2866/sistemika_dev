"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { CRMMotivoPerdidaForm } from "./form";
import {
  getMotivoPerdidaBadgeClass,
  getMotivoPerdidaEstadoLabel,
  normalizeMotivoPerdidaPayload,
} from "./model";

//#region Componentes de alta

type CRMMotivoPerdidaCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de alta.
const CRMMotivoPerdidaCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear motivo de perdida CRM</span>
    <Badge variant="secondary" className={getMotivoPerdidaBadgeClass(true)}>
      {getMotivoPerdidaEstadoLabel(true)}
    </Badge>
  </div>
);

// Renderiza la pantalla de alta reutilizando el formulario del recurso.
export const CRMMotivoPerdidaCreate = ({
  embedded = false,
  redirect,
}: CRMMotivoPerdidaCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMMotivoPerdidaCreateTitle />}
    className="max-w-2xl w-full"
    transform={normalizeMotivoPerdidaPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMMotivoPerdidaForm />
  </Create>
);

//#endregion Componentes de alta
