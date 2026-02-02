/**
 * Edicion de PoSolicitudes.
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
import { buildPoSolicitudPayload } from "./transformers";
import type { PoSolicitud, PoSolicitudPayload } from "./model";
import { PoSolicitudForm } from "./form";

//******************************* */
// region 1. TITLE

// Construye el titulo de edicion con el id.
const PoSolicitudEditTitle = () => {
  const { record } = useEditContext<PoSolicitud & { id: number }>();
  const idLabel =
    record?.id != null ? `#${String(record.id).padStart(5, "0")}` : "";

  return (
    <div className="flex items-center gap-2">
      <span>Editar Solicitud</span>
      {idLabel ? <span className="text-inherit font-inherit">{idLabel}</span> : null}
    </div>
  );
};
// endregion

//******************************* */
// region 2. EDIT

export const PoSolicitudEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = getReturnToFromLocation(location);
  return (
    <Edit
      title={<PoSolicitudEditTitle />}
      actions={false}
      className="w-full max-w-lg"
      redirect={false}
      transform={(data) => buildPoSolicitudPayload(data as PoSolicitudPayload)}
      mutationOptions={{
        onSuccess: () => {
          if (returnTo) {
            navigate(returnTo, { state: { refresh: true } });
            return;
          }
          navigate("/po-solicitudes", { state: { refresh: true } });
        },
      }}
    >
      <PoSolicitudForm />
    </Edit>
  );
};
// endregion

