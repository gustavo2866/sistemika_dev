"use client";

import { Create } from "@/components/create";
import { CRMMensajeForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { Mail } from "lucide-react";

export const CRMMensajeCreate = () => (
  <Create
    redirect="list"
    title={<ResourceTitle icon={Mail} text="Registrar mensaje CRM" />}
  >
    <CRMMensajeForm />
  </Create>
);
