"use client";

import { Edit } from "@/components/edit";
import { ProyectoForm } from "./form";

export const ProyectoEdit = () => (
  <Edit redirect="list" mutationMode="pessimistic" title="Editar Proyecto">
    <ProyectoForm />
  </Edit>
);
