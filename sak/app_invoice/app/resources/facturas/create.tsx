"use client";

import { Create } from "@/components/create";
import { SimpleForm } from "@/components/simple-form";
import { FacturaFields } from "./form";
import { useGetIdentity } from "ra-core";

export const FacturaCreate = () => {
  const { identity } = useGetIdentity();

  // Patrón oficial de shadcn-admin-kit para valores por defecto
  const defaultValues = {
    tipo_comprobante: "A",
    usuario_responsable_id: identity?.id
  };

  return (
    <Create redirect="list" title="Crear Factura">
      <SimpleForm defaultValues={defaultValues}>
        <FacturaFields mode="create" />
      </SimpleForm>
    </Create>
  );
};
