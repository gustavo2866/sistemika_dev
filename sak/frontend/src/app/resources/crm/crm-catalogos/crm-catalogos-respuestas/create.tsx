"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { CRMCatalogoRespuestaForm } from "./form";
import {
  getCatalogoRespuestaBadgeClass,
  getCatalogoRespuestaEstadoLabel,
  normalizeCatalogoRespuestaPayload,
} from "./model";

//#region Componentes de alta

type CRMCatalogoRespuestaCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de alta.
const CRMCatalogoRespuestaCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear respuesta CRM</span>
    <Badge
      variant="secondary"
      className={getCatalogoRespuestaBadgeClass(true)}
    >
      {getCatalogoRespuestaEstadoLabel(true)}
    </Badge>
  </div>
);

// Renderiza la pantalla de alta reutilizando el formulario del recurso.
export const CRMCatalogoRespuestaCreate = ({
  embedded = false,
  redirect,
}: CRMCatalogoRespuestaCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMCatalogoRespuestaCreateTitle />}
    className="max-w-2xl w-full"
    transform={normalizeCatalogoRespuestaPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMCatalogoRespuestaForm />
  </Create>
);

//#endregion Componentes de alta
