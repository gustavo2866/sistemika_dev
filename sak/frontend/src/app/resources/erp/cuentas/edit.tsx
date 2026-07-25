"use client";

import { useEditContext } from "ra-core";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { ErpCuentaForm } from "./form";
import { normalizeErpCuentaPayload, type ErpCuenta } from "./model";

type ErpCuentaEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const ErpCuentaEditTitle = () => {
  const { record } = useEditContext<ErpCuenta>();
  if (!record) return "Editar cuenta ERP";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar cuenta ERP</span>
      <Badge variant="outline" className="text-[11px]">
        {record.cod_cuenta}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activo ? "Activa" : "Inactiva"}
      </Badge>
    </div>
  );
};

const ErpCuentaEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const ErpCuentaEdit = ({
  embedded = false,
  id,
  redirect,
}: ErpCuentaEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<ErpCuentaEditTitle />}
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={normalizeErpCuentaPayload}
    actions={<ErpCuentaEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCuentaForm />
  </Edit>
);
