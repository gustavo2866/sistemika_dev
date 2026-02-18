"use client";

import { Create } from "@/components/create";
import { ResourceTitle } from "@/components/resource-title";
import { Building } from "lucide-react";

import { TipoPropiedadForm } from "./form";

export const TipoPropiedadCreate = () => (
  <Create title={<ResourceTitle icon={Building} text="Nuevo tipo de propiedad" />}>
    <TipoPropiedadForm />
  </Create>
);

