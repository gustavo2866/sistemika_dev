"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { ResourceTitle } from "@/components/resource-title";
import { Globe } from "lucide-react";

import { ServicioTipoForm } from "./form";

export const ServicioTipoCreate = ({
  embedded = false,
  redirect,
}: SetupCreateComponentProps) => (
  <Create
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    title={<ResourceTitle icon={Globe} text="Nuevo tipo de servicio" />}
  >
    <ServicioTipoForm />
  </Create>
);
