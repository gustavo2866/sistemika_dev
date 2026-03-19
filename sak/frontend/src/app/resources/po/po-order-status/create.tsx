"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { PoOrderStatusForm } from "./form";

type PoOrderStatusCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const PoOrderStatusCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear estado de orden</span>
    <Badge variant="secondary" className="text-[11px]">
      Activo
    </Badge>
  </div>
);

export const PoOrderStatusCreate = ({
  embedded = false,
  redirect,
}: PoOrderStatusCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<PoOrderStatusCreateTitle />}
    className="max-w-2xl w-full"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <PoOrderStatusForm />
  </Create>
);
