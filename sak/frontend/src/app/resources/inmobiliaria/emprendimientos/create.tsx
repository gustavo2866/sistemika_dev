"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { ResourceTitle } from "@/components/resource-title";
import { Building } from "lucide-react";

import { EmprendimientoForm } from "./form";

export const EmprendimientoCreate = ({
  embedded = false,
  redirect,
}: SetupCreateComponentProps) => (
  <Create
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    title={<ResourceTitle icon={Building} text="Crear emprendimiento" />}
  >
    <EmprendimientoForm />
  </Create>
);
