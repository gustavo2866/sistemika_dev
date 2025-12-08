"use client";

export type OwnerOption = { value: string; label: string; avatar?: string | null };

export interface OwnerAssignableRecord {
  asignado_a?:
    | {
        id?: number | string | null;
        nombre?: string | null;
        avatar?: string | null;
        url_foto?: string | null;
      }
    | null;
  asignado_a_id?: number | string | null;
}

export const ensureOwnerOption = <TRecord extends OwnerAssignableRecord>(
  options: OwnerOption[],
  record: TRecord | null,
): OwnerOption[] => {
  if (!record) return options;
  const ownerId = record.asignado_a?.id ?? record.asignado_a_id;
  if (!ownerId) return options;
  const hasOwner = options.some((option) => option.value === String(ownerId));
  if (hasOwner) return options;
  const avatar =
    (record.asignado_a as { avatar?: string; url_foto?: string } | undefined)?.avatar ??
    (record.asignado_a as { url_foto?: string } | undefined)?.url_foto ??
    null;
  return [
    ...options,
    {
      value: String(ownerId),
      label: record.asignado_a?.nombre ?? `Usuario #${ownerId}`,
      avatar,
    },
  ];
};

export const normalizeFormOwnerOptions = (options: OwnerOption[]): OwnerOption[] => {
  const unique = new Map<string, OwnerOption>();
  unique.set("0", { value: "0", label: "Sin asignar", avatar: null });
  options.forEach((option) => {
    if (!unique.has(option.value)) {
      unique.set(option.value, option);
    }
  });
  return Array.from(unique.values());
};
