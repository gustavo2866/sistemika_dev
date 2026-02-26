"use client";

import { Create } from "@/components/create";
import { CRMOportunidadPoForm } from "./form";
import { Target } from "lucide-react";

export const CRMOportunidadPoCreate = () => {
  return (
    <Create
      redirect="edit"
      title={
        <span className="inline-flex items-center gap-2">
          <Target className="h-4 w-4" />
          Crear Oportunidad
        </span>
      }
    >
      <CRMOportunidadPoForm />
    </Create>
  );
};

export default CRMOportunidadPoCreate;
