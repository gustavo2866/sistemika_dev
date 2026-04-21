"use client";

import { Edit } from "@/components/edit";
import type { SetupEditComponentProps } from "@/components/forms/form_order";
import { ResourceTitle } from "@/components/resource-title";
import { Globe } from "lucide-react";

import { ServicioTipoForm } from "./form";

export const ServicioTipoEdit = ({
  embedded = false,
  id,
  redirect,
}: SetupEditComponentProps) => (
  <Edit
    id={id}
    redirect={redirect ?? "list"}
    mutationMode="pessimistic"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    title={<ResourceTitle icon={Globe} text="Editar tipo de servicio" />}
  >
    <ServicioTipoForm />
  </Edit>
);
