"use client";

import { Create } from "@/components/create";
import { ResourceTitle } from "@/components/resource-title";
import { Building } from "lucide-react";

import { EmprendimientoForm } from "./form";

export const EmprendimientoCreate = () => (
  <Create
    redirect="list"
    title={<ResourceTitle icon={Building} text="Crear emprendimiento" />}
  >
    <EmprendimientoForm />
  </Create>
);
