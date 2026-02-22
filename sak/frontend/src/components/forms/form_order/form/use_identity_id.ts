"use client";

import { useMemo } from "react";
import { useGetIdentity } from "ra-core";

export type UseIdentityIdResult = {
  identity?: unknown;
  identityId?: number;
  isIdentityLoading: boolean;
};

export const useIdentityId = (): UseIdentityIdResult => {
  const identityResponse = useGetIdentity();
  const identity =
    (identityResponse as { data?: unknown; identity?: unknown }).data ??
    (identityResponse as { identity?: unknown }).identity;

  const identityIdRaw = (identity as { id?: unknown } | undefined)?.id;
  const identityId = useMemo((): number | undefined => {
    const raw = identityIdRaw;
    if (raw == null || raw === "") return undefined;
    const parsed = typeof raw === "string" ? Number(raw) : raw;
    return Number.isFinite(parsed) ? (parsed as number) : undefined;
  }, [identityIdRaw]);

  const isIdentityLoading = Boolean(
    (identityResponse as { isLoading?: boolean }).isLoading,
  );

  return { identity, identityId, isIdentityLoading };
};
