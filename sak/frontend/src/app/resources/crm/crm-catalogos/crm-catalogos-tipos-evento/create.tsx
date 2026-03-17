"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { CRMTipoEventoForm } from "./form";
import {
  getTipoEventoBadgeClass,
  getTipoEventoEstadoLabel,
  normalizeTipoEventoPayload,
} from "./model";

//#region Componentes de alta

type CRMTipoEventoCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de alta.
const CRMTipoEventoCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear tipo de evento CRM</span>
    <Badge variant="secondary" className={getTipoEventoBadgeClass(true)}>
      {getTipoEventoEstadoLabel(true)}
    </Badge>
  </div>
);

// Renderiza la pantalla de alta reutilizando el formulario del recurso.
export const CRMTipoEventoCreate = ({
  embedded = false,
  redirect,
}: CRMTipoEventoCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMTipoEventoCreateTitle />}
    className="max-w-2xl w-full"
    transform={normalizeTipoEventoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMTipoEventoForm />
  </Create>
);

//#endregion Componentes de alta
