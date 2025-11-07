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
import { ChevronDown } from "lucide-react";

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
}: ComboboxProps) => {
  const [open, setOpen] = useState(false);
  
  const selected = useMemo(
    () => options.find((option) => String(option.id) === value),
    [options, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={className || "w-full justify-between"}
          disabled={loading || disabled}
        >
          {selected
            ? selected.nombre
            : loading
              ? loadingMessage
              : placeholder}
          <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
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
