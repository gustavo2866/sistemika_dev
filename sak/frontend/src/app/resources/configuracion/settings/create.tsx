"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { SettingForm } from "./form";

type SettingCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

export const SettingCreate = ({
  embedded = false,
  redirect,
}: SettingCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear Setting"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <SettingForm />
  </Create>
);