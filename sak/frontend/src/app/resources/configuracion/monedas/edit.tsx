"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { MonedaForm } from "./form";

type MonedaEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

export const MonedaEdit = ({
  embedded = false,
  id,
  redirect,
}: MonedaEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title="Editar Moneda"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <MonedaForm />
  </Edit>
);
