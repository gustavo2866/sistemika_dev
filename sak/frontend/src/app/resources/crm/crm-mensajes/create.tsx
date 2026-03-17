"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { CRMMensajeSalidaForm } from "./form_mensaje";
import {
  getMensajeEstadoBadgeClass,
  getMensajeTipoBadgeClass,
  formatMensajeEstado,
  formatMensajeTipo,
} from "./model";

//#region Componentes de alta

type CRMMensajeCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de alta.
const CRMMensajeCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Nuevo mensaje CRM</span>
    <Badge variant="secondary" className={getMensajeTipoBadgeClass("salida")}>
      {formatMensajeTipo("salida")}
    </Badge>
    <Badge variant="secondary" className={getMensajeEstadoBadgeClass("pendiente_envio")}>
      {formatMensajeEstado("pendiente_envio")}
    </Badge>
  </div>
);

// Renderiza la pantalla de alta preservando el flujo especial de envio.
export const CRMMensajeCreate = ({
  embedded = false,
  redirect,
}: CRMMensajeCreateProps) => (
  <Create
    redirect={redirect ?? false}
    title={<CRMMensajeCreateTitle />}
    className="max-w-3xl w-full"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMMensajeSalidaForm />
  </Create>
);

//#endregion Componentes de alta
