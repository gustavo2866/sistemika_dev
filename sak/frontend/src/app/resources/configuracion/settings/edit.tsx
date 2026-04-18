"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { SettingForm } from "./form";

type SettingEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

export const SettingEdit = ({
  embedded = false,
  id,
  redirect,
}: SettingEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title="Editar Setting"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <SettingForm />
  </Edit>
);