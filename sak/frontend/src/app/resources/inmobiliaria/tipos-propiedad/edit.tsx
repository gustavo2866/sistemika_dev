"use client";

import { Edit } from "@/components/edit";
import type { SetupEditComponentProps } from "@/components/forms/form_order";
import { ResourceTitle } from "@/components/resource-title";
import { Building } from "lucide-react";

import { TipoPropiedadForm } from "./form";

export const TipoPropiedadEdit = ({
  embedded = false,
  id,
  redirect,
}: SetupEditComponentProps) => (
  <Edit
    id={id}
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    title={<ResourceTitle icon={Building} text="Editar tipo de propiedad" />}
  >
    <TipoPropiedadForm />
  </Edit>
);

