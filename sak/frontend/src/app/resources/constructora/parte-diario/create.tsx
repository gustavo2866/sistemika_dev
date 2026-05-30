"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { NotebookPen } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ParteDiarioForm } from "./form";
import {
  getEstadoParteBadgeClass,
  getEstadoParteLabel,
  normalizeParteDiarioPayload,
} from "./model";

type ParteDiarioCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const ParteDiarioCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="inline-flex items-center gap-2">
      <NotebookPen className="h-4 w-4" />
      Registrar parte diario
    </span>
    <Badge variant="secondary" className={getEstadoParteBadgeClass("pendiente")}>
      {getEstadoParteLabel("pendiente")}
    </Badge>
  </div>
);

export const ParteDiarioCreate = ({
  embedded = false,
  redirect,
}: ParteDiarioCreateProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={redirect ?? false}
      title={<ParteDiarioCreateTitle />}
      className="max-w-5xl w-full"
      transform={normalizeParteDiarioPayload}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={
        redirect
          ? undefined
          : {
              onSuccess: () => {
                if (returnTo) {
                  navigate(returnTo, { replace: true });
                  return;
                }
                navigate("/parte-diario", { replace: true });
              },
            }
      }
    >
      <ParteDiarioForm />
    </Create>
  );
};
