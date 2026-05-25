"use client";

import { Create } from "@/components/create";
import { ProyFaseForm } from "./form";

export const ProyFaseCreate = ({
  embedded = false,
  redirect = "list",
}: {
  embedded?: boolean;
  redirect?: string | false;
}) => (
  <Create
    redirect={redirect}
    title="Crear fase de proyecto"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ProyFaseForm />
  </Create>
);
