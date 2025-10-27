"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { SimpleForm } from "@/components/simple-form";
import ReactDOM from "react-dom";

import { buildFormValues } from "@/components/form/helpers/detailHelpers";
import { SolicitudFormSchema, type SolicitudRecord } from "../model";
import { SolicitudFormHeader } from "./FormHeader";
import { useEnterNavigation } from "@/components/form/use-enter-navigation";

export const SolicitudForm = () => {
  const [isDetailEditorOpen, setIsDetailEditorOpen] = useState(false);
  const [footerContent, setFooterContent] = useState<ReactNode>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);

  const defaultValues = (record?: SolicitudRecord) =>
    buildFormValues(SolicitudFormSchema, record);

  const handleSubmit = useCallback(() => {
    const formElement =
      formContainerRef.current?.querySelector<HTMLFormElement>("form");
    formElement?.requestSubmit();
  }, []);

  const { getEnterNavigationProps } = useEnterNavigation({
    containerRef: formContainerRef,
    submit: handleSubmit,
  });

  return (
    <div ref={formContainerRef} className="w-full">
      <SimpleForm
        className="w-full max-w-5xl space-y-6"
        defaultValues={defaultValues}
        toolbar={isDetailEditorOpen ? null : undefined}
      >
        <SolicitudFormHeader
          setIsDetailEditorOpen={setIsDetailEditorOpen}
          setFooterContent={setFooterContent}
          footerRef={footerRef}
          getEnterNavigationProps={getEnterNavigationProps}
        />
        <div ref={footerRef} />
        {isDetailEditorOpen && footerContent && footerRef.current
          ? ReactDOM.createPortal(footerContent, footerRef.current)
          : null}
      </SimpleForm>
    </div>
  );
};
