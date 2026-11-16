"use client";

import { Create } from "@/components/create";
import { ErpLibroMayorForm } from "./form";
import { normalizeErpLibroMayorPayload } from "./model";


export const ErpLibroMayorCreate = () => (
  <Create
    redirect="list"
    title="Crear registro de Libro Mayor"
    className="max-w-5xl w-full"
    transform={normalizeErpLibroMayorPayload}
  >
    <ErpLibroMayorForm />
  </Create>
);
