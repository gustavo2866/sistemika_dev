"use client";

import { useInput } from "ra-core";

export const HiddenInput = ({ source }: { source: string }) => {
  const { field } = useInput({ source });
  return <input type="hidden" {...field} />;
};

