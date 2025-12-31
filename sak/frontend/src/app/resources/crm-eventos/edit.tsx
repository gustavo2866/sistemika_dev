"use client";

import { Edit } from "@/components/edit";
import { CRMEventoForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { CalendarCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const CRMEventoEdit = () => {
  const navigate = useNavigate();

  return (
    <Edit
      title={<ResourceTitle icon={CalendarCheck} text="Editar Evento CRM" />}
      redirect={false}
      mutationOptions={{
        onSuccess: () => {
          navigate(-1);
        },
      }}
    >
      <CRMEventoForm />
    </Edit>
  );
};
