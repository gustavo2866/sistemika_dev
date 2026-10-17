"use client";

import { Edit, type EditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
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
    mutationMode="pessimistic"
    transform={normalizeMetodoProyeccionPayload}
    actions={(
      <div className="flex justify-end">
        <FormOrderDeleteButton redirect={redirect ?? (embedded ? false : "list")} />
      </div>
    )}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <MetodoProyeccionForm />
  </Edit>
);
