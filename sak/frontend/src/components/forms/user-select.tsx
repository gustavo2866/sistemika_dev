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
          "rounded-2xl border-slate-200/80 bg-white/80 shadow-sm text-sm",
          triggerClassName
        )}
      >
        {selected ? (
          <div className="flex items-center gap-1.5 text-slate-700">
            <Avatar className="size-5 border border-slate-200">
              {selected.avatar ? (
                <AvatarImage src={selected.avatar} alt={selected.label} />
              ) : null}
              <AvatarFallback className="bg-slate-200 text-[9px] font-semibold uppercase text-slate-600">
                {getInitials(selected.label)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{selected.label}</span>
          </div>
        ) : (
          <span className="text-sm text-slate-500">{placeholder}</span>
        )}
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2 text-sm">
              <Avatar className="size-5 border border-slate-200">
                {option.avatar ? (
                  <AvatarImage src={option.avatar} alt={option.label} />
                ) : null}
                <AvatarFallback className="bg-slate-200 text-[9px] font-semibold uppercase text-slate-600">
                  {getInitials(option.label)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
