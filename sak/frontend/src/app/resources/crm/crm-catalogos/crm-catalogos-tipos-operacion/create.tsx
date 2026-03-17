"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { CRMTipoOperacionForm } from "./form";
import {
  getTipoOperacionBadgeClass,
  getTipoOperacionEstadoLabel,
  normalizeTipoOperacionPayload,
} from "./model";

//#region Componentes de alta

type CRMTipoOperacionCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de alta.
const CRMTipoOperacionCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear tipo de operacion CRM</span>
    <Badge variant="secondary" className={getTipoOperacionBadgeClass(true)}>
      {getTipoOperacionEstadoLabel(true)}
    </Badge>
  </div>
);

// Renderiza la pantalla de alta reutilizando el formulario del recurso.
export const CRMTipoOperacionCreate = ({
  embedded = false,
  redirect,
}: CRMTipoOperacionCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMTipoOperacionCreateTitle />}
    className="max-w-2xl w-full"
    transform={normalizeTipoOperacionPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMTipoOperacionForm />
  </Create>
);

//#endregion Componentes de alta
