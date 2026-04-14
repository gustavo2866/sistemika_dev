"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { PropiedadesStatusForm } from "./form";

export const PropiedadesStatusCreate = ({
  embedded = false,
  redirect,
}: SetupCreateComponentProps) => (
  <Create
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    title="Crear estado de propiedad"
  >
    <PropiedadesStatusForm />
  </Create>
);
