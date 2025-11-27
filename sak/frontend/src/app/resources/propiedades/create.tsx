"use client";

import { Create } from "@/components/create";
import { PropiedadForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { Home } from "lucide-react";

export const PropiedadCreate = () => (
  <Create
    redirect="list"
    title={<ResourceTitle icon={Home} text="Crear propiedad" />}
  >
    <PropiedadForm />
  </Create>
);
