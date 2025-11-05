/**
 * Solicitud Form Component
 * 
 * Simplified form wrapper using the declarative GenericForm architecture.
 * All form logic, layout, and behavior is defined in form.config.ts
 * 
 * This component has been reduced from ~470 lines to ~30 lines by moving
 * all form configuration and logic to a declarative config file.
 */

"use client";

import { useParams } from "react-router-dom";
import { GenericForm } from "@/components/form/GenericForm";
import { solicitudFormConfig } from "./form.config";

/**
 * Main form component for creating/editing solicitudes
 */
export const SolicitudForm = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <GenericForm
        config={solicitudFormConfig}
        recordId={id}
      />
    </div>
  );
};
