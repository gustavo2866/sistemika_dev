"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpLibroMayorForm } from "./form";
import { normalizeErpLibroMayorPayload } from "./model";


export const ErpLibroMayorEdit = () => (
  <Edit
    redirect="list"
    title="Editar registro de Libro Mayor"
    className="max-w-5xl w-full"
    mutationMode="pessimistic"
    transform={normalizeErpLibroMayorPayload}
    actions={<div className="flex justify-end"><FormOrderDeleteButton /></div>}
  >
    <ErpLibroMayorForm />
  </Edit>
);
