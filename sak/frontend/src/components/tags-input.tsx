"use client";

import * as React from "react";
import { FieldTitle, type InputProps, useInput, useResourceContext } from "ra-core";
import { X } from "lucide-react";

import { FormControl, FormError, FormField, FormLabel } from "@/components/form";
import { InputHelperText } from "@/components/input-helper-text";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TagsInputProps = InputProps &
  Omit<React.ComponentProps<"input">, "defaultValue" | "onChange" | "size"> & {
    separatorPattern?: RegExp;
  };

const normalizeTag = (value: string) => value.trim().toLowerCase().split(/\s+/).join(" ");

const buildUniqueTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const rawTag of value) {
    const tag = String(rawTag ?? "").trim();
    if (!tag) continue;
    const normalized = normalizeTag(tag);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(tag);
  }
  return tags;
};

export const TagsInput = ({
  className,
  helperText,
  label,
  separatorPattern = /[\n,]+/,
  source,
  ...props
}: TagsInputProps) => {
  const resource = useResourceContext(props);
  const { id, field, isRequired } = useInput<string[]>({ ...props, source });
  const [draft, setDraft] = React.useState("");
  const tags = buildUniqueTags(field.value);

  const commitTags = React.useCallback(
    (rawValue: string) => {
      const chunks = rawValue
        .split(separatorPattern)
        .map((part) => part.trim())
        .filter(Boolean);
      if (!chunks.length) return false;

      const nextTags = [...tags];
      const seen = new Set(tags.map(normalizeTag));
      let changed = false;

      for (const chunk of chunks) {
        const normalized = normalizeTag(chunk);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        nextTags.push(chunk);
        changed = true;
      }

      if (changed) {
        field.onChange(nextTags);
      }
      setDraft("");
      return changed;
    },
    [field, separatorPattern, tags],
  );

  const removeTag = React.useCallback(
    (index: number) => {
      field.onChange(tags.filter((_, currentIndex) => currentIndex !== index));
    },
    [field, tags],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "Tab" || event.key === ",") {
      if (draft.trim()) {
        event.preventDefault();
        commitTags(draft);
      }
      return;
    }

    if (event.key === "Backspace" && !draft && tags.length > 0) {
      event.preventDefault();
      removeTag(tags.length - 1);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (draft.trim()) {
      commitTags(draft);
    }
    field.onBlur();
    props.onBlur?.(event);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!text || !separatorPattern.test(text)) return;
    event.preventDefault();
    commitTags(text);
  };

  return (
    <FormField className={className} id={id} name={field.name}>
      {label !== false && (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        <div className="rounded-md border border-input bg-background px-2 py-1 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]">
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, index) => (
              <Badge
                key={`${normalizeTag(tag)}-${index}`}
                variant="outline"
                className="h-5 gap-1 rounded-sm border-slate-200 bg-slate-50 px-1.5 py-0 text-[9px] font-medium text-slate-700"
              >
                <span className="whitespace-nowrap">{tag}</span>
                <button
                  type="button"
                  className="rounded-sm text-slate-400 transition hover:text-slate-700"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={() => removeTag(index)}
                  aria-label={`Quitar ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Input
              {...props}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                props.onChange?.(event);
              }}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onPaste={handlePaste}
              className={cn(
                "h-5 min-w-[140px] flex-1 border-0 bg-transparent px-1 py-0 text-[10px] shadow-none focus-visible:ring-0 focus-visible:border-transparent",
              )}
            />
          </div>
        </div>
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};
