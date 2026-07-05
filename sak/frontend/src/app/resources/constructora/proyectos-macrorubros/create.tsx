"use client";

import { Create } from "@/components/create";
import { ProyectoMacrorubroForm } from "./form";

export const ProyectoMacrorubroCreate = ({
  embedded = false,
  redirect = "list",
}: {
  embedded?: boolean;
  redirect?: string | false;
}) => (
  <Create
    redirect={redirect}
    title="Crear macrorubro de proyecto"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ProyectoMacrorubroForm />
  </Create>
);
