"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { NominaTareaForm } from "./form";
import { normalizeNominaTareaPayload } from "./model";

type NominaTareaCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const NominaTareaCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear tarea de nomina</span>
    <Badge variant="secondary" className="text-[11px]">
      Activa
    </Badge>
  </div>
);

export const NominaTareaCreate = ({
  embedded = false,
  redirect,
}: NominaTareaCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<NominaTareaCreateTitle />}
    className="max-w-2xl w-full"
    transform={(data: any) => normalizeNominaTareaPayload(data)}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <NominaTareaForm />
  </Create>
);
