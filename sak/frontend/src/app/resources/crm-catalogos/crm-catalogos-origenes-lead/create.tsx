"use client";

import { Create } from "@/components/create";
import { CRMOrigenLeadForm } from "./form";

export const CRMOrigenLeadCreate = () => (
  <Create redirect="list" title="Crear Origen de Lead CRM">
    <CRMOrigenLeadForm />
  </Create>
);
