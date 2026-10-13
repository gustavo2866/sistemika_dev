"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { NominaLicenciaDeleteButton } from "./license-delete-button";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";

import { NominaLicenciaForm } from "./form";
import {
  TIPO_NOVEDAD_CHOICES,
  type NominaLicencia,
} from "./model";

type NominaLicenciaEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const NominaLicenciaEditTitle = () => {
  const { record } = useEditContext<NominaLicencia>();
  if (!record) return "Editar licencia de nómina";

  const empleado = [record.nomina?.apellido, record.nomina?.nombre]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const tipo = TIPO_NOVEDAD_CHOICES.find(
    (choice) => choice.id === record.tipo_novedad,
  )?.name;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar licencia de nómina</span>
      {empleado ? (
        <Badge variant="outline" className="text-[11px]">
          {empleado}
        </Badge>
      ) : null}
      <Badge variant="secondary" className="text-[11px]">
        {tipo ?? record.tipo_novedad}
      </Badge>
    </div>
  );
};

const NominaLicenciaEditActions = ({ redirect }: { redirect: BaseEditProps["redirect"] }) => (
  <div className="flex justify-end">
    <NominaLicenciaDeleteButton redirect={redirect} />
  </div>
);

export const NominaLicenciaEdit = ({
  embedded = false,
  id,
  redirect,
}: NominaLicenciaEditProps) => {
  const destination = redirect ?? (embedded ? false : "list");
  const cancelTo =
    typeof destination === "string" && destination.startsWith("/")
      ? destination
      : undefined;

  return (
    <Edit
      id={id}
      redirect={destination}
      title={<NominaLicenciaEditTitle />}
      className="max-w-3xl w-full"
      mutationMode="pessimistic"
      actions={<NominaLicenciaEditActions redirect={destination} />}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
    >
      <NominaLicenciaForm cancelTo={cancelTo} />
    </Edit>
  );
};
