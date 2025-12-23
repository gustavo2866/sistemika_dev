"use client";

import { useMemo } from "react";
import { useGetList } from "ra-core";
import { UserSelect, type UserSelectOption, type UserSelectProps } from "./user-select";

export interface ResponsableSelectorProps extends Omit<UserSelectProps, "options"> {
  includeTodos?: boolean;
  perPage?: number;
}

export const ResponsableSelector = ({
  includeTodos = true,
  perPage = 200,
  ...props
}: ResponsableSelectorProps) => {
  const { data: usuarios = [] } = useGetList("users", {
    pagination: { page: 1, perPage },
  });

  const options = useMemo<UserSelectOption[]>(
    () => {
      const base = usuarios.map((user: any) => ({
        value: String(user.id),
        label: user.nombre ?? user.email ?? `Usuario #${user.id}`,
        avatar: user.url_foto ?? user.avatar ?? null,
      }));
      return includeTodos ? [{ value: "todos", label: "Todos", avatar: null }, ...base] : base;
    },
    [usuarios, includeTodos]
  );

  return <UserSelect options={options} {...props} />;
};
