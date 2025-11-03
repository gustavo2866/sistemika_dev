"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Check, ChevronsUpDown } from "lucide-react";

type Articulo = {
  id: number;
  nombre: string;
};

type ArticuloComboboxProps = {
  value: number | null;
  onChange: (id: number | null) => void;
  articulos: Articulo[];
  allowNull?: boolean;
  placeholder?: string;
  emptyText?: string;
  nullText?: string;
  className?: string;
};

/**
 * Combobox reutilizable para seleccionar artículos con búsqueda
 * 
 * @example
 * ```tsx
 * <ArticuloCombobox
 *   value={currentItem.articulo_id}
 *   onChange={(id) => handleItemChange("articulo_id", id)}
 *   articulos={articulos}
 *   allowNull={true}
 * />
 * ```
 */
export const ArticuloCombobox = ({
  value,
  onChange,
  articulos,
  allowNull = true,
  placeholder = "Selecciona un artículo...",
  emptyText = "No se encontraron artículos.",
  nullText = "Sin artículo",
  className,
}: ArticuloComboboxProps) => {
  const [open, setOpen] = useState(false);

  const selectedArticulo = articulos.find((art) => art.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedArticulo?.nombre || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start" side="bottom" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Buscar artículo..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {allowNull && (
                <CommandItem
                  value="sin-articulo"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === null ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {nullText}
                </CommandItem>
              )}
              {articulos.map((art) => (
                <CommandItem
                  key={art.id}
                  value={art.nombre}
                  onSelect={() => {
                    onChange(art.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === art.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {art.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
