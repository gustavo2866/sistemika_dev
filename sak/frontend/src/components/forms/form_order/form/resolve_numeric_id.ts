export const resolveNumericId = (value: unknown): number | undefined => {
  if (value == null) return undefined;

  if (typeof value === "object") {
    const candidate =
      (value as { id?: unknown; value?: unknown }).id ??
      (value as { value?: unknown }).value;

    return resolveNumericId(candidate);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "0") return undefined;

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  return undefined;
};