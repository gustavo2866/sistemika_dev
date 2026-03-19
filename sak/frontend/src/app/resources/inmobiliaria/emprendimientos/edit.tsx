"use client";

import { Edit } from "@/components/edit";
import { ResourceTitle } from "@/components/resource-title";
import { Building } from "lucide-react";

import { EmprendimientoForm } from "./form";

export const EmprendimientoEdit = () => (
  <Edit title={<ResourceTitle icon={Building} text="Editar emprendimiento" />}>
    <EmprendimientoForm />
  </Edit>
);
