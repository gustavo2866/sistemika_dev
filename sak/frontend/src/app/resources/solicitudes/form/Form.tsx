"use client";

import { useRef, useState, type ReactNode } from "react";
import { SimpleForm } from "@/components/simple-form";
import ReactDOM from "react-dom";
import type { RaRecord } from "ra-core";

import { mapDetalleRecords, type SolicitudFormValues, type SolicitudRecord } from "../model";
import { SolicitudFormHeader } from "./FormHeader";

export const SolicitudForm = () => {
  const [isDetailEditorOpen, setIsDetailEditorOpen] = useState(false);
  const [footerContent, setFooterContent] = useState<ReactNode>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const defaultValues = (record?: RaRecord) => {
    const solicitudRecord = record as SolicitudRecord | undefined;
    return {
      tipo: solicitudRecord?.tipo ?? "normal",
      fecha_necesidad: solicitudRecord?.fecha_necesidad ?? "",
      comentario: solicitudRecord?.comentario ?? "",
      solicitante_id: solicitudRecord?.solicitante_id ?? undefined,
      version: solicitudRecord?.version,
      detalles: mapDetalleRecords(solicitudRecord?.detalles ?? []),
    } satisfies SolicitudFormValues;
  };

  return (
    <SimpleForm
      className="w-full max-w-5xl space-y-6"
      defaultValues={defaultValues}
      toolbar={isDetailEditorOpen ? null : undefined}
    >
      <SolicitudFormHeader
        setIsDetailEditorOpen={setIsDetailEditorOpen}
        setFooterContent={setFooterContent}
        footerRef={footerRef}
      />
      <div ref={footerRef} />
      {isDetailEditorOpen && footerContent && footerRef.current
        ? ReactDOM.createPortal(footerContent, footerRef.current)
        : null}
    </SimpleForm>
  );
};
