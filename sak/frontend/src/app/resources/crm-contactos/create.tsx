"use client";

import { Create } from "@/components/create";
import { CRMContactoForm } from "./form";

export const CRMContactoCreate = () => (
  <Create redirect="list" title="Crear Contacto CRM">
    <CRMContactoForm />
  </Create>
);
