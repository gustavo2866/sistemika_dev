"use client";

import { Create } from "@/components/create";
import { CRMMensajeSalidaForm } from "./form_mensaje";
import { ResourceTitle } from "@/components/resource-title";
import { Mail } from "lucide-react";

export const CRMMensajeCreate = () => (
  <Create
    redirect={false}
    title={<ResourceTitle icon={Mail} text="Nuevo mensaje de salida" />}
  >
    <CRMMensajeSalidaForm />
  </Create>
);
