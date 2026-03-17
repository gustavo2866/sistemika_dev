"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { CRMCondicionPagoForm } from "./form";
import {
  getCondicionPagoBadgeClass,
  getCondicionPagoEstadoLabel,
  normalizeCondicionPagoPayload,
} from "./model";

//#region Componentes de alta

type CRMCondicionPagoCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de alta.
const CRMCondicionPagoCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear condicion de pago CRM</span>
    <Badge
      variant="secondary"
      className={getCondicionPagoBadgeClass(true)}
    >
      {getCondicionPagoEstadoLabel(true)}
    </Badge>
  </div>
);

// Renderiza la pantalla de alta reutilizando el formulario del recurso.
export const CRMCondicionPagoCreate = ({
  embedded = false,
  redirect,
}: CRMCondicionPagoCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMCondicionPagoCreateTitle />}
    className="max-w-2xl w-full"
    transform={normalizeCondicionPagoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMCondicionPagoForm />
  </Create>
);

//#endregion Componentes de alta
