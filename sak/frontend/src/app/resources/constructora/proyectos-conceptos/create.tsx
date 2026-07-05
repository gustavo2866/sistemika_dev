"use client";

import { Create } from "@/components/create";
import { ProyectoConceptoForm } from "./form";

export const ProyectoConceptoCreate = ({
  embedded = false,
  redirect = "list",
}: {
  embedded?: boolean;
  redirect?: string | false;
}) => (
  <Create
    redirect={redirect}
    title="Crear concepto de proyecto"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ProyectoConceptoForm />
  </Create>
);
