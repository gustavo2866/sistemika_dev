"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { TipoActualizacionForm } from "./form";

export const TipoActualizacionCreate = ({
  embedded = false,
  redirect,
}: SetupCreateComponentProps) => (
  <Create
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    title="Crear tipo de actualizacion"
  >
    <TipoActualizacionForm />
  </Create>
);
