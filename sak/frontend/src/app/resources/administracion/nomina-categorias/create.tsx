"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { NominaCategoriaForm } from "./form";
import { normalizeNominaCategoriaPayload } from "./model";

type NominaCategoriaCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const NominaCategoriaCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear categoria de nomina</span>
    <Badge variant="secondary" className="text-[11px]">
      Activa
    </Badge>
  </div>
);

export const NominaCategoriaCreate = ({
  embedded = false,
  redirect,
}: NominaCategoriaCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<NominaCategoriaCreateTitle />}
    className="max-w-2xl w-full"
    transform={(data: any) => normalizeNominaCategoriaPayload(data)}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <NominaCategoriaForm />
  </Create>
);
