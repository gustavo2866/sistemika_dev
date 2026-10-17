"use client";

import { Create, type CreateProps } from "@/components/create";
import { MetodoProyeccionForm } from "./form";
import { normalizeMetodoProyeccionPayload } from "./model";

export const MetodoProyeccionCreate = ({
  embedded = false,
  redirect,
}: {
  embedded?: boolean;
  redirect?: CreateProps["redirect"];
}) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear método de proyección"
    className="max-w-5xl w-full"
    transform={normalizeMetodoProyeccionPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <MetodoProyeccionForm />
  </Create>
);
