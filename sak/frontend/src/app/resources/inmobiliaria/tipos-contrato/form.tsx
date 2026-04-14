"use client";

import { useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Braces, PlusCircle, Trash2 } from "lucide-react";

import { SimpleForm } from "@/components/simple-form";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  TIPO_CONTRATO_DEFAULT,
  TIPO_CONTRATO_VALIDATIONS,
  tipoContratoSchema,
  type TipoContratoFormValues,
} from "./model";

// ── Variables disponibles para inserción en cuerpo ───────────────────────────

const VARIABLES_GRUPOS = [
  {
    label: "Fecha / Lugar",
    vars: ["ciudad", "provincia", "fecha_dia", "fecha_mes", "fecha_anio", "fecha_inicio", "fecha_vencimiento", "duracion_meses", "duracion_anios"],
  },
  {
    label: "Locador",
    vars: ["propiedad_propietario", "propietario_dni", "propietario_cuit", "propietario_domicilio", "propietario_email", "propietario_telefono"],
  },
  {
    label: "Locatario",
    vars: ["inquilino_nombre_completo", "inquilino_nombre", "inquilino_apellido", "inquilino_dni", "inquilino_cuit", "inquilino_email", "inquilino_telefono", "inquilino_domicilio"],
  },
  {
    label: "Inmueble",
    vars: ["propiedad_nombre", "propiedad_domicilio", "propiedad_localidad", "propiedad_provincia", "propiedad_cp", "propiedad_matricula", "propiedad_metros", "propiedad_ambientes"],
  },
  {
    label: "Económico",
    vars: ["valor_alquiler", "valor_alquiler_num", "moneda", "expensas", "deposito_garantia", "tipo_actualizacion"],
  },
  {
    label: "Garante 1",
    vars: ["garante1_nombre_completo", "garante1_dni", "garante1_cuit", "garante1_domicilio", "garante1_tipo_garantia"],
  },
  {
    label: "Garante 2",
    vars: ["garante2_nombre_completo", "garante2_dni", "garante2_cuit", "garante2_domicilio", "garante2_tipo_garantia"],
  },
] as const;

// ── Textarea con chips de inserción de variables ──────────────────────────────

type CuerpoConVariablesProps = {
  value: string;
  onChange: (val: string) => void;
  error?: string;
};

const CuerpoConVariables = ({ value, onChange, error }: CuerpoConVariablesProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPosRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const saveCursor = () => {
    const el = textareaRef.current;
    if (!el) return;
    cursorPosRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const insertVar = (varName: string) => {
    const token = `{{ ${varName} }}`;
    const { start, end } = cursorPosRef.current;
    const current = value ?? "";
    const next = current.slice(0, start) + token + current.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
      cursorPosRef.current = { start: pos, end: pos };
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">Cuerpo</label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <Braces className="h-3 w-3" />
              Variables
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {VARIABLES_GRUPOS.map((grupo) => (
              <DropdownMenuSub key={grupo.label}>
                <DropdownMenuSubTrigger className="text-xs">
                  {grupo.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  {grupo.vars.map((v) => (
                    <DropdownMenuItem
                      key={v}
                      className="font-mono text-[10px] text-primary cursor-pointer"
                      onSelect={() => insertVar(v)}
                    >
                      {`{{ ${v} }}`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Textarea
        ref={textareaRef}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onSelect={saveCursor}
        onKeyUp={saveCursor}
        onMouseUp={saveCursor}
        placeholder="Texto de la cláusula con variables {{ como_esta }}..."
        className="min-h-[120px] text-xs font-mono resize-y"
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
};

// ── Sección: Datos del tipo de contrato ──────────────────────────────────────

const TipoContratoMainFields = () => (
  <div className="grid gap-3 md:grid-cols-[180px_minmax(0,260px)_92px] md:items-start">
    <div className="md:max-w-[180px]">
      <FormText
        source="nombre"
        label="Nombre"
        validate={required()}
        widthClass="w-full"
        maxLength={TIPO_CONTRATO_VALIDATIONS.NOMBRE_MAX}
      />
    </div>
    <div className="md:max-w-[260px]">
      <FormTextarea
        source="descripcion"
        label="Descripcion"
        widthClass="w-full"
        maxLength={TIPO_CONTRATO_VALIDATIONS.DESCRIPCION_MAX}
        className="[&_textarea]:min-h-9 [&_textarea]:h-9 [&_textarea]:resize-none"
      />
    </div>
    <div className="flex min-h-[38px] items-end md:max-w-[92px]">
      <FormBoolean source="activo" label="Activo" defaultValue />
    </div>
  </div>
);

// ── Sección: Encabezado del template ─────────────────────────────────────────

const TipoContratoTemplateHeaderFields = () => (
  <div className="flex flex-col gap-2">
    <FormText
      source="template.titulo"
      label="Título del contrato"
      widthClass="w-full"
      maxLength={200}
    />
    <FormText
      source="template.subtitulo"
      label="Subtítulo"
      widthClass="w-full"
      maxLength={200}
    />
    <FormTextarea
      source="template.lugar_y_fecha"
      label="Texto de lugar y fecha"
      widthClass="w-full"
      className="[&_textarea]:min-h-[80px]"
    />
  </div>
);

// ── Sección: Cláusulas ────────────────────────────────────────────────────────

const ClausulaHeader = ({ index }: { index: number }) => {
  const numero = useWatch({ name: `template.clausulas.${index}.numero` });
  const titulo = useWatch({ name: `template.clausulas.${index}.titulo` });
  return (
    <span className="text-sm text-left">
      {numero ? (
        <span className="font-semibold text-muted-foreground mr-2">{numero}</span>
      ) : null}
      {titulo || <span className="italic text-muted-foreground">Sin título</span>}
    </span>
  );
};

const TipoContratoClausulasFields = () => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "template.clausulas" as any,
  });

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground py-1">
          No hay cláusulas. Agregue una para comenzar.
        </p>
      ) : (
        <div className="max-h-[280px] overflow-y-auto pr-1">
        <Accordion type="multiple" className="w-full">
          {fields.map((field, index) => (
            <AccordionItem
              key={field.id}
              value={`clausula-${index}`}
              className="border rounded-md mb-2 px-3 last:mb-0"
            >
              <AccordionTrigger className="py-2 hover:no-underline">
                <ClausulaHeader index={index} />
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3 pb-3">
                  <div className="flex gap-2">
                    <Controller
                      control={control}
                      name={`template.clausulas.${index}.numero` as any}
                      render={({ field: f, fieldState }) => (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-foreground">Número</label>
                          <Input
                            {...f}
                            placeholder="PRIMERA"
                            className="w-28 text-xs h-8"
                          />
                          {fieldState.error && (
                            <span className="text-xs text-destructive">
                              {fieldState.error.message}
                            </span>
                          )}
                        </div>
                      )}
                    />
                    <Controller
                      control={control}
                      name={`template.clausulas.${index}.titulo` as any}
                      render={({ field: f, fieldState }) => (
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs font-medium text-foreground">Título</label>
                          <Input
                            {...f}
                            placeholder="Título de la cláusula"
                            className="text-xs h-8"
                          />
                          {fieldState.error && (
                            <span className="text-xs text-destructive">
                              {fieldState.error.message}
                            </span>
                          )}
                        </div>
                      )}
                    />
                  </div>
                  <Controller
                    control={control}
                    name={`template.clausulas.${index}.cuerpo` as any}
                    render={({ field: f, fieldState }) => (
                      <CuerpoConVariables
                        value={f.value}
                        onChange={f.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 h-7 text-xs"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar cláusula
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 w-fit text-xs"
        onClick={() => append({ numero: "", titulo: "", cuerpo: "" })}
      >
        <PlusCircle className="h-3.5 w-3.5" />
        Agregar cláusula
      </Button>
    </div>
  );
};

// ── Form principal ────────────────────────────────────────────────────────────

export const TipoContratoForm = () => (
  <SimpleForm<TipoContratoFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(tipoContratoSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={TIPO_CONTRATO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del tipo de contrato"
      main={<TipoContratoMainFields />}
      defaultOpen
    />
    <SectionBaseTemplate
      title="Encabezado del template"
      main={<TipoContratoTemplateHeaderFields />}
      defaultOpen={false}
      persistKey="tipo-contrato-template-header"
    />
    <SectionBaseTemplate
      title="Cláusulas"
      main={<TipoContratoClausulasFields />}
      defaultOpen={false}
      persistKey="tipo-contrato-clausulas"
    />
  </SimpleForm>
);
