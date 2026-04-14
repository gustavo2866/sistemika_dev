"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { ResourceTitle } from "@/components/resource-title";
import { Building } from "lucide-react";

import { TipoPropiedadForm } from "./form";

export const TipoPropiedadCreate = ({
  embedded = false,
  redirect,
}: SetupCreateComponentProps) => (
  <Create
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    title={<ResourceTitle icon={Building} text="Nuevo tipo de propiedad" />}
  >
    <TipoPropiedadForm />
  </Create>
);

