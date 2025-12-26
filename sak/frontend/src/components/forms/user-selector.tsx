"use client";

import { useMemo } from "react";
import type { UserIdentity } from "ra-core";
import type { OwnerAssignableRecord } from "@/components/kanban/crm-owner-options";
import { ensureOwnerOption } from "@/components/kanban/crm-owner-options";
import { useCrmOwnerOptions } from "@/components/kanban/use-crm-owner-options";
import { UserSelect, type UserSelectProps } from "./user-select";

export type UserSelectorVariant = "filter" | "form";

export interface UserSelectorProps<
  TRecord extends OwnerAssignableRecord = OwnerAssignableRecord,
> extends Omit<UserSelectProps, "options"> {
  records: TRecord[];
  identity?: UserIdentity | null;
  variant?: UserSelectorVariant;
  ensureRecord?: TRecord | null;
}

export const UserSelector = <
  TRecord extends OwnerAssignableRecord = OwnerAssignableRecord,
>({
  records,
  identity,
  variant = "filter",
  ensureRecord = null,
  ...props
}: UserSelectorProps<TRecord>) => {
  const { ownerOptions, assignableOwnerOptions } = useCrmOwnerOptions(records, identity);

  const options = useMemo(
    () =>
      variant === "form"
        ? ensureOwnerOption(assignableOwnerOptions, ensureRecord)
        : ownerOptions,
    [assignableOwnerOptions, ensureRecord, ownerOptions, variant],
  );

  return <UserSelect options={options} {...props} />;
};

