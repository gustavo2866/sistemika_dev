"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type UserSelectOption = {
  value: string;
  label: string;
  avatar?: string | null;
};

export interface UserSelectProps extends React.ComponentProps<typeof Select> {
  options: UserSelectOption[];
  placeholder?: string;
  triggerClassName?: string;
  hideLabel?: boolean;
  hideLabelOnSmall?: boolean;
}

const getInitials = (name?: string) => {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const UserSelect = ({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar usuario",
  triggerClassName,
  hideLabel,
  hideLabelOnSmall,
  ...props
}: UserSelectProps) => {
  const selected = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  return (
    <Select value={value} onValueChange={onValueChange} {...props}>
      <SelectTrigger
        className={cn(
          "h-9 px-3 py-2 rounded-md border-slate-200/80 bg-white/80 shadow-sm text-sm",
          triggerClassName
        )}
      >
        {selected ? (
          <div className="flex items-center gap-1.5 text-slate-700">
            <Avatar
              className={cn(
                "size-3.5 border border-slate-200 sm:size-4",
                (hideLabel || hideLabelOnSmall) && "size-7 sm:size-8"
              )}
            >
              {selected.avatar ? (
                <AvatarImage src={selected.avatar} alt={selected.label} />
              ) : null}
              <AvatarFallback className="bg-slate-200 text-[7px] font-semibold uppercase text-slate-600 sm:text-[8px]">
                {getInitials(selected.label)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "truncate text-sm font-normal",
                hideLabel ? "hidden" : undefined,
                hideLabelOnSmall ? "hidden sm:inline" : undefined
              )}
            >
              {selected.label}
            </span>
          </div>
        ) : (
          <span className="text-sm font-normal text-slate-500">{placeholder}</span>
        )}
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2 text-sm">
              <Avatar className="size-4 border border-slate-200">
                {option.avatar ? (
                  <AvatarImage src={option.avatar} alt={option.label} />
                ) : null}
                <AvatarFallback className="bg-slate-200 text-[8px] font-semibold uppercase text-slate-600">
                  {getInitials(option.label)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
