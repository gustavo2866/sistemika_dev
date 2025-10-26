"use client";

import { useState } from "react";
import { Controller, type Control, type UseFormReturn } from "react-hook-form";
import { ArrowLeft, Pencil, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

import type { DetalleEditorValues } from "../model";

type SolicitudFormDetailsEditProps = {
  detalleForm: UseFormReturn<DetalleEditorValues>;
  articulos: Array<{ id: number; nombre: string }>;
  isEditMode: boolean;
  onSubmit: () => void;
  onClose: () => void;
  onDelete?: () => void;
  showInlineActions?: boolean;
};

export const SolicitudFormDetailsEdit = ({
  detalleForm,
  articulos,
  isEditMode,
  onSubmit,
  onClose,
  onDelete,
  showInlineActions = true,
}: SolicitudFormDetailsEditProps) => {
  const [isArticuloPickerOpen, setIsArticuloPickerOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Pencil className="size-4" />
          {isEditMode ? "Editar detalle" : "Nuevo detalle"}
        </div>
        {isEditMode && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive gap-2"
            tabIndex={-1}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        <Controller
          control={detalleForm.control}
          name="articulo_id"
          render={({ field }) => {
            const selectedName =
              field.value && field.value.length > 0
                ? articulos.find((item) => String(item.id) === field.value)?.nombre ?? ""
                : "";
            return (
              <div className="space-y-2">
                <Label htmlFor="articulo_id">Articulo</Label>
                <Popover
                  open={isArticuloPickerOpen}
                  onOpenChange={setIsArticuloPickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isArticuloPickerOpen}
                      id="articulo_id"
                      className="w-full md:max-w-[50ch] justify-between"
                    >
                      <span className="truncate">
                        {selectedName || "Seleccionar articulo"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar articulo..." />
                      <CommandEmpty>No se encontraron articulos.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="sin seleccionar"
                          onSelect={() => {
                            field.onChange("");
                            setIsArticuloPickerOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${!field.value ? "opacity-100" : "opacity-0"}`}
                          />
                          Sin seleccionar
                        </CommandItem>
                        {articulos.map((articulo) => {
                          const value = String(articulo.id);
                          const isSelected = field.value === value;
                          return (
                            <CommandItem
                              key={articulo.id}
                              value={`${articulo.nombre} ${articulo.id}`}
                              onSelect={() => {
                                field.onChange(value);
                                setIsArticuloPickerOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`}
                              />
                              {articulo.nombre}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            );
          }}
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-[8ch_10ch] md:gap-3">
          <FieldControl
            control={detalleForm.control}
            name="unidad_medida"
            label="Uni Med"
            placeholder="UN"
            maxLength={3}
            className="w-full"
          />
          <FieldControl
            control={detalleForm.control}
            name="cantidad"
            label="Cantidad"
            type="number"
            placeholder="0"
            min="0"
            step="0.001"
            className="w-full"
          />
        </div>

        <FieldTextArea
          control={detalleForm.control}
          name="descripcion"
          label="Descripción"
          placeholder="Describe la necesidad"
          rows={4}
          required
        />
      </div>

      {showInlineActions ? (
        <div className="flex justify-between pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="gap-2 px-6"
            tabIndex={-1}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <Button type="button" onClick={onSubmit} className="gap-2 px-6">
            <Save className="h-4 w-4" />
            Aceptar
          </Button>
        </div>
      ) : null}
    </div>
  );
};

const FieldControl = ({
  control,
  name,
  label,
  type = "text",
  placeholder,
  min,
  step,
  maxLength,
  className,
}: {
  control: Control<DetalleEditorValues>;
  name: keyof DetalleEditorValues;
  label: string;
  type?: string;
  placeholder?: string;
  min?: string;
  step?: string;
  maxLength?: number;
  className?: string;
}) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => (
      <div className="space-y-2">
        <Label htmlFor={name}>{label}</Label>
        <Input
          id={name}
          type={type}
          placeholder={placeholder}
          min={min}
          step={step}
          maxLength={maxLength}
          value={field.value ?? ""}
          onChange={field.onChange}
          className={className}
        />
      </div>
    )}
  />
);

const FieldTextArea = ({
  control,
  name,
  label,
  placeholder,
  rows = 3,
  required,
}: {
  control: Control<DetalleEditorValues>;
  name: keyof DetalleEditorValues;
  label: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => (
      <div className="space-y-2">
        <Label htmlFor={name}>{label}</Label>
        <Textarea
          id={name}
          rows={rows}
          placeholder={placeholder}
          value={field.value ?? ""}
          onChange={field.onChange}
          required={required}
        />
      </div>
    )}
  />
);


