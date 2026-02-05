/**
 * Edicion de Ordenes de Compra.
 *
 * Estructura:
 * 1. TITLE - Titulo dinamico
 * 2. EDIT - Componente principal
 */

"use client";

import { useLocation, useNavigate } from "react-router-dom";
import { useEditContext } from "ra-core";
import { Edit } from "@/components/edit";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";
import { buildPoOrdenCompraPayload } from "./transformers";
import type { PoOrdenCompra, PoOrdenCompraPayload } from "./model";
import { PoOrdenCompraForm } from "./form";

//******************************* */
// region 1. TITLE

// Construye el titulo de edicion con el id.
const PoOrdenCompraEditTitle = () => {
  const { record } = useEditContext<PoOrdenCompra & { id: number }>();
  const idLabel =
    record?.id != null ? `#${String(record.id).padStart(5, "0")}` : "";

  return (
    <div className="flex items-center gap-2">
      <span>Editar Orden</span>
      {idLabel ? <span className="text-inherit font-inherit">{idLabel}</span> : null}
    </div>
  );
};
// endregion

//******************************* */
// region 2. EDIT

export const PoOrdenCompraEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = getReturnToFromLocation(location);
  
  return (
    <Edit
      title={<PoOrdenCompraEditTitle />}
      actions={false}
      className="w-full max-w-lg"
      mutationMode="pessimistic"
      transform={(data) => buildPoOrdenCompraPayload(data as PoOrdenCompraPayload)}
      mutationOptions={{
        onSuccess: () => {
          if (returnTo) {
            navigate(returnTo, { state: { refresh: true } });
          }
          // Si no hay returnTo, dejamos que React Admin haga el redirect por defecto
        },
      }}
    >
      <PoOrdenCompraForm />
    </Edit>
  );
};
// endregion

