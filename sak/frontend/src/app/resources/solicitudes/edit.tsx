/**
 * Solicitud Edit Component
 * 
 * Simple wrapper that renders the form with the record ID.
 * All loading and data fetching logic is handled by GenericForm.
 */

"use client";

import { SolicitudForm } from "./form";

/**
 * Edit page for solicitudes - delegates to the unified form component
 */
export const SolicitudEdit = () => {
  return <SolicitudForm />;
};
