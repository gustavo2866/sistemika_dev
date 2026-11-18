"use client";

import { Edit, type EditProps } from "@/components/edit";
import { MetodoProyeccionForm } from "./form";
import { normalizeMetodoProyeccionPayload } from "./model";

export const MetodoProyeccionEdit = ({
  embedded = false,
  id,
  redirect,
}: {
  embedded?: boolean;
  id?: EditProps["id"];
  redirect?: EditProps["redirect"];
}) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title="Editar método de proyección"
    className="max-w-5xl w-full"
    contentClassName="max-w-5xl"
    mutationMode="pessimistic"
    transform={normalizeMetodoProyeccionPayload}
    actions={false}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <MetodoProyeccionForm />
  </Edit>
);
