"use client";

import { GitBranch } from "lucide-react";

import { Create } from "@/components/create";
import { ErpRubroForm } from "./form";
import { normalizeErpRubroPayload } from "./model";

type ErpRubroCreateProps = {
  embedded?: boolean;
  redirect?: string | false;
};

const ErpRubroCreateTitle = () => (
  <span className="inline-flex items-center gap-2">
    <GitBranch className="h-4 w-4" />
    Crear rubro ERP
  </span>
);

export const ErpRubroCreate = ({
  embedded = false,
  redirect = "list",
}: ErpRubroCreateProps) => (
  <Create
    redirect={redirect}
    title={<ErpRubroCreateTitle />}
    className="max-w-6xl w-full"
    contentClassName="max-w-[920px] w-full"
    transform={normalizeErpRubroPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpRubroForm />
  </Create>
);
