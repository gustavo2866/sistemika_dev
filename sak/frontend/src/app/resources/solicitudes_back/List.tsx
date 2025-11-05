/**
 * Solicitudes List - Simplified with GenericList
 * 
 * This component is now just a wrapper around GenericList,
 * with all configuration moved to list.config.ts
 */

"use client";

import { GenericList } from "@/components/list/GenericList";
import { solicitudListConfig } from "./list.config";

export const SolicitudList = () => {
  return <GenericList config={solicitudListConfig} />;
};

