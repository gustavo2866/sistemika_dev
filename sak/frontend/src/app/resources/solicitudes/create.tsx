"use client";

import { Create } from "@/components/create";
import { Form } from "./form";

export const SolicitudCreate = () => (
  <Create redirect="list" title="Nueva Solicitud">
    <Form />
  </Create>
);
