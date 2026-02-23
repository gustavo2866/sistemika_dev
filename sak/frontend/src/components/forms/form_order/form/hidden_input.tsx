"use client";

import { useInput } from "ra-core";

export const HiddenInput = ({ source, defaultValue }: { source: string; defaultValue?: string }) => {
  const { field } = useInput({ source, defaultValue });
  return <input type="hidden" {...field} />;
};

