"use client";

import { Create } from "@/components/create";
import { SolicitudForm } from "./form";

export const SolicitudCreate = () => (
  <Create redirect="list" title="Nueva Solicitud">
    <SolicitudForm />
  </Create>
);

