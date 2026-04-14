"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { PropietarioForm } from "./form";

export const PropietarioCreate = ({
  embedded = false,
  redirect,
}: SetupCreateComponentProps) => (
  <Create
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    title="Crear propietario"
  >
    <PropietarioForm />
  </Create>
);
