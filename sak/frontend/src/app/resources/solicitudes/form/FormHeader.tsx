"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { required, useGetIdentity, useRecordContext } from "ra-core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { useRouter } from "next/navigation";

import {
  formatSolicitudSummary,
  solicitudTipoChoices,
  type SolicitudFormValues,
  type SolicitudRecord,
} from "../model";
import { SolicitudFormDetails } from "./FormDetails";

type SolicitudFormHeaderProps = {
  setIsDetailEditorOpen: (open: boolean) => void;
  setFooterContent: (node: ReactNode) => void;
  footerRef: RefObject<HTMLDivElement | null>;
};

export const SolicitudFormHeader = ({
  setIsDetailEditorOpen,
  setFooterContent,
  footerRef: _footerRef,
}: SolicitudFormHeaderProps) => {
  const router = useRouter();
  const record = useRecordContext<SolicitudRecord>();
  const { data: identity } = useGetIdentity();
  const isEditMode = !!(record && record.id);
  const isCreateMode = !isEditMode;
  const [generalOpen, setGeneralOpen] = useState(!isEditMode);
  const form = useFormContext<SolicitudFormValues>();

  const tipo = useWatch({ name: "tipo" });
  const comentario = useWatch({ name: "comentario" });
  const fechaNecesidad = useWatch({ name: "fecha_necesidad" });

  useEffect(() => {
    if (isCreateMode && identity?.id) {
      const currentValues = form.getValues();
      const today = new Date().toISOString().split("T")[0];

      if (!currentValues.fecha_necesidad) {
        form.setValue("fecha_necesidad", today);
      }
      if (!currentValues.solicitante_id) {
        form.setValue("solicitante_id", identity.id);
      }
      if (!currentValues.tipo) {
        form.setValue("tipo", "normal");
      }
    }
  }, [form, identity, isCreateMode]);

  const summary = useMemo(
    () =>
      formatSolicitudSummary({
        tipo,
        comentario,
        fechaNecesidad,
      }),
    [comentario, fechaNecesidad, tipo],
  );

  const [shouldOpenEditor, setShouldOpenEditor] = useState(false);

  const handleAccept = useCallback(() => {
    const currentDetalles = form.getValues("detalles") || [];
    if (currentDetalles.length === 0) {
      form.setValue("detalles", [
        {
          id: undefined,
          articulo_id: undefined,
          descripcion: "",
          unidad_medida: "",
          cantidad: 0,
        },
      ]);
    }
    setGeneralOpen(false);
    setTimeout(() => {
      setShouldOpenEditor((prev) => (prev ? prev : true));
    }, 100);
  }, [form]);

  useEffect(() => {
    if (form.formState.isSubmitSuccessful) {
      router.back();
    }
  }, [form.formState.isSubmitSuccessful, router]);

  return (
    <div className="space-y-6 pb-36">
      <Card className="overflow-hidden">
        <div className="p-4 bg-muted/30 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                Informacion General
                {record?.id && (
                  <span className="text-lg font-semibold text-muted-foreground align-middle">
                    ID: {record.id}
                  </span>
                )}
              </h3>
              {!generalOpen && (
                <p className="text-sm text-muted-foreground mt-1">{summary}</p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setGeneralOpen((open) => !open)}
              className="gap-2"
            >
              <span className="hidden sm:inline">
                {generalOpen ? "Ocultar" : "Mostrar"}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${generalOpen ? "" : "-rotate-90"}`}
              />
            </Button>
          </div>
        </div>
        {generalOpen && (
          <div className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectInput
                source="tipo"
                label="Tipo"
                choices={solicitudTipoChoices}
                className="w-full"
              />
              <TextInput
                source="fecha_necesidad"
                label="Fecha de Necesidad"
                type="date"
                validate={required()}
                className="w-full"
              />
            </div>
            <ReferenceInput
              source="solicitante_id"
              reference="users"
              label="Solicitante"
            >
              <SelectInput optionText="nombre" className="w-full" validate={required()} />
            </ReferenceInput>
            <TextInput
              source="comentario"
              label="Comentario"
              multiline
              rows={3}
              className="w-full"
            />

            {isCreateMode && (
              <div className="flex justify-end pt-2">
                <Button type="button" onClick={handleAccept} className="px-6">
                  Aceptar
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <SolicitudFormDetails
        shouldOpenEditor={shouldOpenEditor}
        onEditorOpened={() => setShouldOpenEditor(false)}
        setIsDetailEditorOpen={setIsDetailEditorOpen}
        setFooterContent={setFooterContent}
      />
    </div>
  );
};

