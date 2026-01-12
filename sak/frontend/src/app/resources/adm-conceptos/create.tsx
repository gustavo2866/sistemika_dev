"use client";

import { Create } from "@/components/create";
import { AdmConceptoForm } from "./form";

export const AdmConceptoCreate = () => (
  <Create redirect="list" title="Crear concepto">
    <AdmConceptoForm />
  </Create>
);
