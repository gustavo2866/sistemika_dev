"use client";

import { useMemo } from "react";
import type { Identity } from "ra-core";
import type { OwnerAssignableRecord, OwnerOption } from "./crm-owner-options";
import { normalizeFormOwnerOptions } from "./crm-owner-options";

export const useCrmOwnerOptions = <
  TRecord extends OwnerAssignableRecord = OwnerAssignableRecord,
>(
  records: TRecord[],
  identity?: Identity | null,
) => {
  const ownerOptions = useMemo<OwnerOption[]>(() => {
    const entries = new Map<string, OwnerOption>();
    records.forEach((record) => {
      const id = record.asignado_a?.id ?? record.asignado_a_id;
      if (!id) return;
      const key = String(id);
      if (entries.has(key)) return;
      const label = record.asignado_a?.nombre || `Usuario #${id}`;
      const avatar =
        (record.asignado_a as { avatar?: string; url_foto?: string } | undefined)?.avatar ??
        (record.asignado_a as { url_foto?: string } | undefined)?.url_foto ??
        null;
      entries.set(key, { value: key, label, avatar });
    });
    if (identity?.id) {
      const identityId = String(identity.id);
      if (!entries.has(identityId)) {
        const avatar =
          (identity as { avatar?: string; url_foto?: string })?.avatar ??
          (identity as { url_foto?: string })?.url_foto ??
          null;
        const label =
          (identity as { fullName?: string; nombre?: string })?.fullName ||
          (identity as { nombre?: string })?.nombre ||
          (identity as { username?: string })?.username ||
          identity.email ||
          `Usuario #${identity.id}`;
        entries.set(identityId, {
          value: identityId,
          label,
          avatar,
        });
      }
    }
    return [{ value: "todos", label: "Todos", avatar: null }, ...Array.from(entries.values())];
  }, [records, identity]);

  const assignableOwnerOptions = useMemo(
    () => normalizeFormOwnerOptions(ownerOptions.filter((option) => option.value !== "todos")),
    [ownerOptions]
  );

  return { ownerOptions, assignableOwnerOptions };
};
