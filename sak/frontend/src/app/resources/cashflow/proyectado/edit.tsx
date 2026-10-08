"use client";

import { Edit, type EditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpCashProyectadoForm } from "./form";
import { normalizeErpCashProyectadoPayload } from "./model";

export const ErpCashProyectadoEdit = ({
  embedded = false,
  id,
  redirect,
}: {
  embedded?: boolean;
  id?: EditProps["id"];
  redirect?: EditProps["redirect"];
}) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title="Editar proyectado Cash"
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={normalizeErpCashProyectadoPayload}
    actions={<div className="flex justify-end"><FormOrderDeleteButton /></div>}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashProyectadoForm />
  </Edit>
);
