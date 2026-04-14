"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { TipoContratoForm } from "./form";

export const TipoContratoCreate = ({
  embedded = false,
  redirect,
}: SetupCreateComponentProps) => (
  <Create
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    title="Crear tipo de contrato"
  >
    <TipoContratoForm />
  </Create>
);
