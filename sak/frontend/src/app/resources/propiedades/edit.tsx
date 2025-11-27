"use client";

import { Edit } from "@/components/edit";
import { PropiedadForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { Home } from "lucide-react";

export const PropiedadEdit = () => (
  <Edit title={<ResourceTitle icon={Home} text="Editar propiedad" />}>
    <PropiedadForm />
  </Edit>
);
