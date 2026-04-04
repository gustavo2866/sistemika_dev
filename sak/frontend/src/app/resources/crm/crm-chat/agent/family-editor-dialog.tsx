"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { ResourceContextProvider, required, useNotify, useSourceContext } from "ra-core";
import { useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import {
  DetailFieldCell,
  FORM_FIELD_READONLY_CLASS,
  FormErrorSummary,
  FormBoolean,
  FormSelect,
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { TagsInput } from "@/components/tags-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { requestMaterialFamily, saveMaterialFamily } from "./api";
import type { MaterialFamily, MaterialRequestItem } from "./types";

type MaterialFamilyEditorDialogProps = {
  apiUrl: string;
  getAuthHeaders: () => HeadersInit;
  item: MaterialRequestItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type MaterialFamilyFormAttribute = {
  nombre: string;
  descripcion: string;
  default_input: string;
  obligatorio: boolean;
  tipo_dato: "free" | "numero" | "enum";
  valores_posibles: string[];
};

type MaterialFamilyFormValues = {
  codigo: string;
  nombre: string;
  estado: "sugerida" | "confirmada";
  descripcion: string;
  tags: string[];
  atributos: MaterialFamilyFormAttribute[];
};

const FAMILY_STATUS_CHOICES = [
  { id: "sugerida", name: "Sugerida" },
  { id: "confirmada", name: "Confirmada" },
] as const;

const ATTRIBUTE_DATA_TYPE_CHOICES = [
  { id: "free", name: "Libre" },
  { id: "numero", name: "Numero" },
  { id: "enum", name: "Lista" },
] as const;

const normalizeCode = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const inferAttributeDataType = (
  attributeName: string | null | undefined,
): "free" | "numero" => {
  const normalized = String(attributeName || "").trim().toLowerCase();
  return normalized.endsWith("_mm") ||
    normalized.endsWith("_m") ||
    normalized.endsWith("_kg") ||
    normalized.endsWith("_l")
    ? "numero"
    : "free";
};

const parseDefaultValue = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (!Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
};

const stringifyDefaultValue = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const buildDraftFamilyFromItem = (item: MaterialRequestItem): MaterialFamily => {
  const attributeNames = new Set<string>();
  const atributos = Object.entries(item.atributos ?? {}).reduce<MaterialFamily["atributos"]>(
    (acc, [key, value]) => {
      if (!key) return acc;
      attributeNames.add(key);
      acc.push({
        nombre: key,
        descripcion: "",
        default: value ?? null,
        obligatorio: false,
        tipo_dato: inferAttributeDataType(key) === "numero" ? "numero" : null,
        valores_posibles: [],
      });
      return acc;
    },
    [],
  );

  for (const missing of item.faltantes ?? []) {
    if (!missing || attributeNames.has(missing)) continue;
    attributeNames.add(missing);
    atributos.push({
      nombre: missing,
      descripcion: "",
      default: null,
      obligatorio: false,
      tipo_dato: inferAttributeDataType(missing) === "numero" ? "numero" : null,
      valores_posibles: [],
    });
  }

  const familyName = (item.familia || "nueva_familia").trim();

  return {
    codigo: normalizeCode(familyName),
    nombre: familyName,
    estado: "sugerida",
    descripcion: "",
    tags: [],
    atributos,
  };
};

const toFormValues = (family: MaterialFamily): MaterialFamilyFormValues => ({
  codigo: family.codigo,
  nombre: family.nombre,
  estado: family.estado === "sugerida" ? "sugerida" : "confirmada",
  descripcion: family.descripcion ?? "",
  tags: family.tags ?? [],
  atributos: (family.atributos ?? []).map((attribute) => ({
    nombre: attribute.nombre ?? "",
    descripcion: attribute.descripcion ?? "",
    default_input: stringifyDefaultValue(attribute.default),
    obligatorio: Boolean(attribute.obligatorio),
      tipo_dato:
        attribute.tipo_dato === "numero"
          ? "numero"
          : attribute.tipo_dato === "enum" || (attribute.valores_posibles?.length ?? 0) > 0
            ? "enum"
          : inferAttributeDataType(attribute.nombre),
    valores_posibles: attribute.valores_posibles ?? [],
  })),
});

const fromFormValues = (values: MaterialFamilyFormValues): MaterialFamily => ({
  codigo: normalizeCode(values.codigo || values.nombre),
  nombre: values.nombre.trim(),
  estado: values.estado,
  descripcion: values.descripcion.trim(),
  tags: (values.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
  atributos: (values.atributos ?? [])
    .map((attribute) => ({
      nombre: attribute.nombre.trim(),
      descripcion: attribute.descripcion.trim(),
      default: parseDefaultValue(attribute.default_input),
      obligatorio: Boolean(attribute.obligatorio),
      tipo_dato:
        attribute.tipo_dato === "numero"
          ? ("numero" as const)
          : attribute.tipo_dato === "enum"
            ? ("enum" as const)
            : null,
      valores_posibles:
        attribute.tipo_dato !== "enum"
          ? []
          : (attribute.valores_posibles ?? [])
              .map((value) => value.trim())
              .filter(Boolean),
    }))
    .filter((attribute) => attribute.nombre),
});

const MaterialFamilyToolbar = ({
  onCancel,
  saving,
}: {
  onCancel: () => void;
  saving: boolean;
}) => (
  <div className="flex items-center justify-end gap-2 pt-1">
    <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
      Cancelar
    </Button>
    <Button type="submit" variant="secondary" size="sm" disabled={saving}>
      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
      Guardar familia
    </Button>
  </div>
);

const ATTRIBUTE_COLUMNS: SectionDetailColumn[] = [
  { label: "Atributo", width: "98px" },
  { label: "Descripcion", width: "minmax(54px,1fr)" },
  { label: "Default", width: "84px" },
  { label: "Req.", width: "66px" },
  { label: "Dato", width: "104px" },
  { label: "", width: "56px" },
];

const getAttributeDefaults = (): MaterialFamilyFormAttribute => ({
  nombre: "",
  descripcion: "",
  default_input: "",
  obligatorio: false,
  tipo_dato: "free",
  valores_posibles: [],
});

const buildEditableFamilyDraft = (item: MaterialRequestItem): MaterialFamily => {
  if (item.familia_sugerida) {
    return {
      ...item.familia_sugerida,
      estado: item.familia_sugerida.estado === "confirmada" ? "confirmada" : "sugerida",
      tags: item.familia_sugerida.tags ?? [],
      atributos: item.familia_sugerida.atributos ?? [],
    };
  }
  return buildDraftFamilyFromItem(item);
};

const MaterialFamilyAttributeFields = ({ isActive }: SectionDetailFieldsProps) => (
  <>
    <DetailFieldCell label="Atributo" className="gap-0">
      <FormText
        source="nombre"
        label={false}
        validate={required()}
        widthClass="w-full"
        defaultValue=""
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Descripcion" className="gap-0">
      <FormText
        source="descripcion"
        label={false}
        widthClass="w-full"
        defaultValue=""
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Default" className="gap-0">
      <FormText
        source="default_input"
        label={false}
        widthClass="w-full"
        defaultValue=""
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Req." className="gap-0">
      <FormBoolean
        source="obligatorio"
        label={false}
        defaultValue={false}
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
    <DetailFieldCell label="Tipo" className="gap-0">
      <FormSelect
        source="tipo_dato"
        label={false}
        choices={[...ATTRIBUTE_DATA_TYPE_CHOICES]}
        widthClass="w-full"
        defaultValue="free"
        className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
      />
    </DetailFieldCell>
  </>
);

const MaterialFamilyAttributeOptionalFields = ({ isActive }: SectionDetailFieldsProps) => {
  const sourceContext = useSourceContext();
  const tipoDatoSource = sourceContext.getSource("tipo_dato");
  const obligatorioSource = sourceContext.getSource("obligatorio");
  const tipoDato = useWatch({
    name: tipoDatoSource,
  }) as "free" | "numero" | "enum" | undefined;
  const obligatorio = useWatch({ name: obligatorioSource }) as boolean | undefined;
  const isNumeric = tipoDato === "numero";
  const isEnum = tipoDato === "enum";

  return (
    <div className="w-full">
      <div className="mt-0 rounded-md border border-muted/60 bg-muted/30 p-2">
        {isNumeric ? (
          <div className="text-[11px] text-muted-foreground">
            El backend buscara un numero en la respuesta del usuario para completar este atributo.
          </div>
        ) : isEnum ? (
          <div className="grid gap-2 md:grid-cols-1">
            <TagsInput
              source="valores_posibles"
              label="Valores posibles"
              placeholder="Escribe un valor y presiona Enter"
              className={isActive ? "w-full" : cn("w-full", FORM_FIELD_READONLY_CLASS)}
            />
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">
            Atributo libre. Solo se completa si aparece explicitamente en la descripcion
            del item.
            {obligatorio ? " Define un tipo para que pueda ser obligatorio." : ""}
          </div>
        )}
      </div>
    </div>
  );
};

export const MaterialFamilyEditorDialog = ({
  apiUrl,
  getAuthHeaders,
  item,
  open,
  onOpenChange,
}: MaterialFamilyEditorDialogProps) => {
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedFamily, setLoadedFamily] = useState<MaterialFamily | null>(null);
  const [isNewFamily, setIsNewFamily] = useState(false);

  const familyKey = item?.familia?.trim() ?? "";

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!open || !item || !familyKey) {
        setLoadedFamily(null);
        setIsNewFamily(false);
        return;
      }

      setLoading(true);
      try {
        const family = await requestMaterialFamily({
          apiUrl,
          familyKey,
          authHeaders: getAuthHeaders(),
        });
        if (!cancelled) {
          setLoadedFamily(family);
          setIsNewFamily(false);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo cargar la familia.";
        if (!cancelled) {
          if (message.includes("404") || message.toLowerCase().includes("no encontrada")) {
            setLoadedFamily(buildEditableFamilyDraft(item));
            setIsNewFamily(true);
          } else {
            notify(message, { type: "warning" });
            setLoadedFamily(buildEditableFamilyDraft(item));
            setIsNewFamily(true);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, familyKey, getAuthHeaders, item, notify, open]);

  const defaultValues = useMemo<MaterialFamilyFormValues | null>(() => {
    if (!loadedFamily) return null;
    return toFormValues(loadedFamily);
  }, [loadedFamily]);

  const handleSubmit = async (values: MaterialFamilyFormValues) => {
    if (!familyKey) return;

    const invalidRequiredType = values.atributos.find(
      (attribute) => attribute.obligatorio && attribute.tipo_dato === "free",
    );
    if (invalidRequiredType) {
      notify(`El atributo '${invalidRequiredType.nombre || "(sin nombre)"}' es obligatorio y debe definir un tipo.`, {
        type: "warning",
      });
      return;
    }

    const invalidEnum = values.atributos.find(
      (attribute) =>
        attribute.obligatorio &&
        attribute.tipo_dato === "enum" &&
        (attribute.valores_posibles ?? []).map((value) => value.trim()).filter(Boolean).length === 0,
    );
    if (invalidEnum) {
      notify(`El atributo '${invalidEnum.nombre || "(sin nombre)"}' es obligatorio y debe definir valores posibles.`, {
        type: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const family = fromFormValues(values);
      const response = await saveMaterialFamily({
        apiUrl,
        familyKey,
        authHeaders: getAuthHeaders(),
        family,
      });
      setLoadedFamily(response.family);
      setIsNewFamily(false);
      notify(response.created ? "Familia creada." : "Familia actualizada.", {
        type: "success",
      });
      onOpenChange(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "No se pudo guardar la familia.",
        { type: "warning" },
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] gap-3 rounded-xl p-4 sm:max-w-[860px]"
        overlayClassName="hidden"
      >
        <DialogHeader className="gap-1">
          <DialogTitle className="text-base">
            {isNewFamily ? "Nueva familia sugerida" : "Editar familia"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ajusta la definicion que usa el agente para interpretar pedidos de materiales.
          </DialogDescription>
        </DialogHeader>

        {loading || !defaultValues ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin" />
              Cargando familia...
            </div>
          </div>
        ) : (
          <ResourceContextProvider value="agente/familias-materiales">
            <SimpleForm<MaterialFamilyFormValues>
              key={`${familyKey}-${defaultValues.codigo}-${isNewFamily ? "new" : "existing"}`}
              className="w-full max-w-none"
              defaultValues={defaultValues}
              onSubmit={handleSubmit as any}
              toolbar={<MaterialFamilyToolbar onCancel={() => onOpenChange(false)} saving={saving} />}
            >
              <FormErrorSummary />
              <SectionBaseTemplate
                title="Datos generales"
                main={
                  <div className="grid gap-2 md:grid-cols-[180px_220px_140px]">
                    <FormText
                      source="codigo"
                      label="Codigo"
                      validate={required()}
                      widthClass="w-full md:w-[180px]"
                      readOnly={!isNewFamily}
                      className={
                        "[&_label]:text-[10px] [&_label]:font-semibold [&_label]:text-sky-800 " +
                        "[&_input]:border-sky-300 [&_input]:bg-sky-50 [&_input]:font-semibold " +
                        "[&_input]:text-sky-950 [&_input]:shadow-[inset_0_1px_2px_rgba(14,116,144,0.08)] " +
                        "[&_input:read-only]:cursor-default"
                      }
                    />
                    <FormText
                      source="nombre"
                      label="Nombre"
                      validate={required()}
                      widthClass="w-full md:w-[220px]"
                    />
                    <FormSelect
                      source="estado"
                      label="Estado"
                      choices={[...FAMILY_STATUS_CHOICES]}
                      validate={required()}
                      widthClass="w-full md:w-[140px]"
                    />
                    <FormTextarea
                      source="descripcion"
                      label="Descripcion"
                      widthClass="w-full md:col-span-2"
                      className="md:col-span-2 [&_textarea]:min-h-[90px]"
                    />
                  </div>
                }
                defaultOpen
              />
              <SectionBaseTemplate
                title="Tags para inferencia"
                main={
                  <TagsInput
                    source="tags"
                    label="Tags"
                    placeholder="Escribe un tag y presiona Enter"
                    className="w-full"
                  />
                }
                defaultOpen
              />
              <SectionDetailTemplate2
                title="Atributos esperados"
                detailsSource="atributos"
                mainColumns={ATTRIBUTE_COLUMNS}
                mainFields={MaterialFamilyAttributeFields}
                optionalFields={MaterialFamilyAttributeOptionalFields}
                defaults={getAttributeDefaults}
                defaultOpen
                maxHeightClassName="md:max-h-52"
              />
            </SimpleForm>
          </ResourceContextProvider>
        )}
      </DialogContent>
    </Dialog>
  );
};
