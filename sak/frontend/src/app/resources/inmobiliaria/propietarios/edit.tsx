"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { type SetupEditComponentProps } from "@/components/forms/form_order";
import type { MouseEventHandler } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PropietarioForm } from "./form";

export const PropietarioEdit = ({
  embedded = false,
  id,
  onCancel,
  onSaved,
  redirect,
}: SetupEditComponentProps & {
  onCancel?: MouseEventHandler<HTMLButtonElement>;
  onSaved?: () => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const locationState = location.state as { returnTo?: string } | null;
  const returnTo = locationState?.returnTo ?? params.get("returnTo");
  const resolvedRedirect = onSaved || returnTo ? false : (redirect ?? "list");

  return (
    <Edit
      id={id}
      redirect={resolvedRedirect}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      title="Editar propietario"
      className="max-w-2xl w-full"
      mutationMode="pessimistic"
      mutationOptions={
        onSaved
          ? {
              onSuccess: onSaved,
            }
          : returnTo
          ? {
              onSuccess: () => navigate(returnTo, { replace: true }),
            }
          : undefined
      }
      actions={
        <div className="flex justify-end">
          <FormOrderDeleteButton />
        </div>
      }
    >
      <PropietarioForm onCancel={onCancel} />
    </Edit>
  );
};
