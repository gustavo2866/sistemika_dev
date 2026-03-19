"use client";

import { Edit } from "@/components/edit";
import { ResourceTitle } from "@/components/resource-title";
import { Building } from "lucide-react";

import { TipoPropiedadForm } from "./form";

export const TipoPropiedadEdit = () => (
  <Edit title={<ResourceTitle icon={Building} text="Editar tipo de propiedad" />}>
    <TipoPropiedadForm />
  </Edit>
);

