import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComboboxOption {
  id: number | string;
  nombre: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  loading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  loadingMessage?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  clearValue?: string;
}

export const Combobox = ({
  value,
  onChange,
  options,
  loading = false,
  placeholder = "Selecciona una opcion",
  searchPlaceholder = "Buscar...",
  loadingMessage = "Cargando...",
  emptyMessage = "Sin resultados.",
  disabled = false,
  className,
  clearable = false,
  clearValue = "",
}: ComboboxProps) => {
  const [open, setOpen] = useState(false);
  
  const selected = useMemo(
    () => options.find((option) => String(option.id) === value),
    [options, value]
  );
  const canClear = clearable && Boolean(value) && !disabled && !loading;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full justify-between text-left", className)}
          disabled={loading || disabled}
        >
          <span className="flex-1 truncate text-left">
            {selected
              ? selected.nombre
              : loading
                ? loadingMessage
                : placeholder}
          </span>
          {canClear ? (
            <span
              role="button"
              className="ml-2 inline-flex h-6 w-6 items-center justify-center text-muted-foreground/70 hover:text-muted-foreground"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange(clearValue);
              }}
            >
              <X className="h-4 w-4" />
            </span>
          ) : null}
          <ChevronDown className="ml-1 h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            {loading ? (
              <CommandEmpty>{loadingMessage}</CommandEmpty>
            ) : (
              <>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={option.nombre}
                      onSelect={() => {
                        onChange(String(option.id));
                        setOpen(false);
                      }}
                    >
                      {option.nombre}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
