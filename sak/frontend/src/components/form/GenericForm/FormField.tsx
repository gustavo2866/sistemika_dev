/**
 * FormField Component
 * 
 * Renders a single form field based on its configuration.
 * Handles different field types (text, number, select, etc.) and validation.
 */

"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useDataProvider } from "ra-core";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ReferenceField } from "@/components/form/ReferenceField";
import type { FieldConfig } from "./types";

interface FormFieldProps<T = any> {
  config: FieldConfig<T>;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

type OptionItem = { id: any; name: string };
const comboboxOptionsCache = new Map<string, OptionItem[]>();

/**
 * ComboboxField - Searchable select field using shadcn/ui Combobox pattern
 */
function ComboboxField({ config, value, onChange, error }: FormFieldProps) {
  const dataProvider = useDataProvider();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const cacheKey = useMemo(() => {
    if (config.fetchOptions) return null;
    if (config.reference) {
      const filtersKey = config.referenceFilters
        ? JSON.stringify(config.referenceFilters)
        : "";
      return `ref:${config.reference}:${config.referenceSource || "nombre"}:${filtersKey}`;
    }
    if (config.options) {
      return `static:${JSON.stringify(config.options)}`;
    }
    return null;
  }, [
    config.fetchOptions,
    config.reference,
    config.referenceSource,
    config.referenceFilters,
    config.options,
  ]);

  const cachedOptions = useMemo(
    () => (cacheKey ? comboboxOptionsCache.get(cacheKey) ?? null : null),
    [cacheKey]
  );

  const [options, setOptions] = useState<Array<OptionItem>>(
    cachedOptions ?? []
  );
  const [loading, setLoading] = useState(() => !cachedOptions);

  const openPopover = useCallback(() => setOpen(true), []);
  const closePopover = useCallback(() => setOpen(false), []);

  useEffect(() => {
    let isMounted = true;

    const applyOptions = (nextOptions: OptionItem[]) => {
      if (!isMounted) return;
      setOptions(nextOptions);
      setLoading(false);
    };

    if (cachedOptions) {
      applyOptions(cachedOptions);
      return () => {
        isMounted = false;
      };
    }

    if (config.options && !config.fetchOptions && !config.reference) {
      const mapped = config.options.map((opt) => ({
        id: opt.value,
        name: opt.label,
      }));
      if (cacheKey) {
        comboboxOptionsCache.set(cacheKey, mapped);
      }
      applyOptions(mapped);
      return () => {
        isMounted = false;
      };
    }

    const loadOptions = async () => {
      try {
        setLoading(true);
        let nextOptions: OptionItem[] = [];

        if (config.fetchOptions) {
          const fetchedOptions = await config.fetchOptions();
          nextOptions = fetchedOptions.map((opt) => ({
            id: opt.value,
            name: opt.label,
          }));
        } else if (config.reference) {
          const { data } = await dataProvider.getList(config.reference, {
            pagination: { page: 1, perPage: 1000 },
            sort: { field: config.referenceSource || "nombre", order: "ASC" },
            filter: config.referenceFilters || {},
          });

          const optionTextField = config.referenceSource || "nombre";
          nextOptions = data.map((item: any) => ({
            id: item.id,
            name: item[optionTextField] || `ID: ${item.id}`,
          }));
        }

        if (cacheKey && !config.fetchOptions) {
          comboboxOptionsCache.set(cacheKey, nextOptions);
        }

        applyOptions(nextOptions);
      } catch (error) {
        console.error("Error loading combobox options:", error);
        if (isMounted) {
          setOptions([]);
          setLoading(false);
        }
      }
    };

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, [
    cacheKey,
    cachedOptions,
    config.options,
    config.fetchOptions,
    config.reference,
    config.referenceSource,
    config.referenceFilters,
    dataProvider,
  ]);

  useEffect(() => {
    if (config.autoFocus && !loading && triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [config.autoFocus, loading]);

  const selectedOption = options.find(
    (opt) => opt.id === value || String(opt.id) === String(value)
  );

  if (loading) {
    return (
      <Button variant="outline" disabled className="w-full justify-between">
        Cargando...
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", error && "border-red-500")}
          disabled={config.disabled}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter") {
              event.preventDefault();
              openPopover();
            }
          }}
        >
          {selectedOption
            ? selectedOption.name
            : config.placeholder || "Seleccionar..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            autoFocus
            placeholder={
              config.searchable !== false
                ? config.placeholder || "Buscar..."
                : undefined
            }
          />
          <CommandList>
            <CommandEmpty>No se encontraron resultados.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => {
                    onChange(option.id);
                    closePopover();
                  }}
                >
                  {option.name}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === option.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function FormField<T = any>({
  config,
  value,
  onChange,
  error,
}: FormFieldProps<T>) {
  const fieldId = `field-${String(config.name)}`;

  // Custom render if provided
  if (config.customRender) {
    return config.customRender({ value, onChange, error });
  }

  const renderField = () => {
    switch (config.type) {
      case "text":
        return (
          <Input
            id={fieldId}
            type="text"
            placeholder={config.placeholder}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={config.disabled}
            className={error ? "border-red-500" : ""}
          />
        );

      case "textarea":
        return (
          <Textarea
            id={fieldId}
            placeholder={config.placeholder}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={config.disabled}
            className={error ? "border-red-500" : ""}
            rows={4}
          />
        );

      case "number":
        return (
          <Input
            id={fieldId}
            type="number"
            placeholder={config.placeholder}
            value={value ?? ""}
            onChange={(e) => {
              const inputValue = e.target.value;
              if (inputValue === "") {
                onChange(null);
                return;
              }
              const parsed = Number(inputValue);
              onChange(Number.isNaN(parsed) ? null : parsed);
            }}
            disabled={config.disabled}
            min={config.min}
            max={config.max}
            step={config.step}
            className={error ? "border-red-500" : ""}
          />
        );

      case "date":
        return (
          <Input
            id={fieldId}
            type="date"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={config.disabled}
            className={error ? "border-red-500" : ""}
          />
        );

      case "select":
        return (
          <Select
            value={value ?? ""}
            onValueChange={onChange}
            disabled={config.disabled}
          >
            <SelectTrigger className={error ? "border-red-500" : ""}>
              <SelectValue placeholder={config.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {config.options?.map((option) => (
                <SelectItem
                  key={option.value}
                  value={String(option.value)}
                  disabled={option.disabled}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={fieldId}
              checked={value || false}
              onCheckedChange={onChange}
              disabled={config.disabled}
            />
            <Label
              htmlFor={fieldId}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {config.label}
            </Label>
          </div>
        );

      case "reference":
        return <ReferenceField config={config} value={value} onChange={onChange} />;

      case "combobox":
        return <ComboboxField config={config} value={value} onChange={onChange} error={error} />;

      default:
        return (
          <div className="text-sm text-muted-foreground">
            Tipo de campo no soportado: {config.type}
          </div>
        );
    }
  };

  // Don't render label for checkbox (it has its own label)
  if (config.type === "checkbox") {
    return (
      <div className={config.fullWidth ? "lg:col-span-2" : ""}>
        {renderField()}
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className={config.fullWidth ? "lg:col-span-2" : ""}>
      <Label htmlFor={fieldId}>
        {config.label}
        {config.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="mt-1.5">{renderField()}</div>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}

