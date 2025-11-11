"use client";

import { Create } from "@/components/create";
import { TipoSolicitudForm } from "./form";

export const TipoSolicitudCreate = () => (
  <Create redirect="list" title="Crear tipo de solicitud">
    <TipoSolicitudForm />
  </Create>
);
