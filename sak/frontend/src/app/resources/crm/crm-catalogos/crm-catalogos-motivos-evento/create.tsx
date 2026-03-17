"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { CRMMotivoEventoForm } from "./form";
import {
  getMotivoEventoBadgeClass,
  getMotivoEventoEstadoLabel,
  normalizeMotivoEventoPayload,
} from "./model";

//#region Componentes de alta

type CRMMotivoEventoCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de alta.
const CRMMotivoEventoCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear motivo de evento CRM</span>
    <Badge variant="secondary" className={getMotivoEventoBadgeClass(true)}>
      {getMotivoEventoEstadoLabel(true)}
    </Badge>
  </div>
);

// Renderiza la pantalla de alta reutilizando el formulario del recurso.
export const CRMMotivoEventoCreate = ({
  embedded = false,
  redirect,
}: CRMMotivoEventoCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMMotivoEventoCreateTitle />}
    className="max-w-2xl w-full"
    transform={normalizeMotivoEventoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMMotivoEventoForm />
  </Create>
);

//#endregion Componentes de alta
