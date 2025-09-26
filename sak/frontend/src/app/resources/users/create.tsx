"use client";

import { Create } from "@/components/create";
import { UserForm } from "./form";

export const UserCreate = () => (
  <Create redirect="list" title="Crear Usuario">
    <UserForm />
  </Create>
);