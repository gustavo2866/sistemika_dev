"use client";

import { Create } from "@/components/create";
import { ResourceTitle } from "@/components/resource-title";
import { Home } from "lucide-react";

import { PropiedadForm } from "./form";

export const PropiedadCreate = () => (
  <Create
    redirect="list"
    title={<ResourceTitle icon={Home} text="Crear propiedad (Inmobiliaria)" />}
  >
    <PropiedadForm />
  </Create>
);
