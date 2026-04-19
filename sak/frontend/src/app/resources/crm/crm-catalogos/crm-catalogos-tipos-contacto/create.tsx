"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { CRMTipoContactoForm } from "./form";
import {
  getTipoContactoBadgeClass,
  getTipoContactoEstadoLabel,
  normalizeTipoContactoPayload,
} from "./model";

//#region Componentes de alta

type CRMTipoContactoCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const CRMTipoContactoCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear tipo de contacto CRM</span>
    <Badge variant="secondary" className={getTipoContactoBadgeClass(true)}>
      {getTipoContactoEstadoLabel(true)}
    </Badge>
  </div>
);

export const CRMTipoContactoCreate = ({
  embedded = false,
  redirect,
}: CRMTipoContactoCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMTipoContactoCreateTitle />}
    className="max-w-2xl w-full"
    transform={normalizeTipoContactoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMTipoContactoForm />
  </Create>
);

//#endregion Componentes de alta
