"use client";

import { Create } from "@/components/create";
import { PoSolicitudForm } from "./form";

export const PoSolicitudCreate = () => (
  <Create redirect="list" title="Nueva Solicitud">
    <PoSolicitudForm />
  </Create>
);

