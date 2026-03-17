"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { CRMOrigenLeadForm } from "./form";
import {
  getOrigenLeadBadgeClass,
  getOrigenLeadEstadoLabel,
  normalizeOrigenLeadPayload,
} from "./model";

//#region Componentes de alta

type CRMOrigenLeadCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de alta.
const CRMOrigenLeadCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear origen de lead CRM</span>
    <Badge variant="secondary" className={getOrigenLeadBadgeClass(true)}>
      {getOrigenLeadEstadoLabel(true)}
    </Badge>
  </div>
);

// Renderiza la pantalla de alta reutilizando el formulario del recurso.
export const CRMOrigenLeadCreate = ({
  embedded = false,
  redirect,
}: CRMOrigenLeadCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMOrigenLeadCreateTitle />}
    className="max-w-2xl w-full"
    transform={normalizeOrigenLeadPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMOrigenLeadForm />
  </Create>
);

//#endregion Componentes de alta
