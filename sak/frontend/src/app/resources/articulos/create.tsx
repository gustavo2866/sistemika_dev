"use client";

import { Create } from "@/components/create";
import { ArticuloForm } from "./form";

export const ArticuloCreate = () => (
  <Create redirect="list" title="Crear articulo">
    <ArticuloForm />
  </Create>
);
