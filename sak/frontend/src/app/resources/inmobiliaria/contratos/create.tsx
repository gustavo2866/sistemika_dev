"use client";

import { Create } from "@/components/create";
import { ResourceTitle } from "@/components/resource-title";
import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ContratoForm } from "./form";

export const ContratoCreate = () => {
  const navigate = useNavigate();
  return (
    <Create
      redirect={false}
      title={<ResourceTitle icon={FileText} text="Crear contrato" />}
      mutationOptions={{
        onSuccess: () => navigate("/contratos"),
      }}
    >
      <ContratoForm />
    </Create>
  );
};
