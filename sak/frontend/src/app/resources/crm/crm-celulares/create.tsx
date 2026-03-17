"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { CRMCelularForm } from "./form";
import {
  getCelularBadgeClass,
  getCelularEstadoLabel,
  normalizeCelularPayload,
} from "./model";

//#region Componentes de alta

type CRMCelularCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de alta.
const CRMCelularCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear celular CRM</span>
    <Badge variant="secondary" className={getCelularBadgeClass(true)}>
      {getCelularEstadoLabel(true)}
    </Badge>
  </div>
);

// Renderiza la pantalla de alta reutilizando el formulario del recurso.
export const CRMCelularCreate = ({
  embedded = false,
  redirect,
}: CRMCelularCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMCelularCreateTitle />}
    className="max-w-2xl w-full"
    transform={normalizeCelularPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMCelularForm />
  </Create>
);

//#endregion Componentes de alta
