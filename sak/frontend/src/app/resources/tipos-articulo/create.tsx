"use client";

import { Create } from "@/components/create";
import { TipoArticuloForm } from "./form";

export const TipoArticuloCreate = () => (
  <Create title="Nuevo tipo de articulo">
    <TipoArticuloForm />
  </Create>
);
