"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { MonedaForm } from "./form";

type MonedaCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

export const MonedaCreate = ({
  embedded = false,
  redirect,
}: MonedaCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear Moneda"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <MonedaForm />
  </Create>
);
