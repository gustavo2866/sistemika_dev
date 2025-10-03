"use client";

import { useCallback, useRef } from "react";
import { Edit } from "@/components/edit";
import { useDataProvider, useNotify } from "ra-core";
import type { RaRecord } from "ra-core";

import { SolicitudForm, type SolicitudFormValues } from "./form";
import {
  getErrorMessage,
  normalizeSolicitudValues,
  syncSolicitudDetalles,
  type SolicitudDetailPayload,
} from "./helpers";

export const SolicitudEdit = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const detalleBuffer = useRef<SolicitudDetailPayload[]>([]);

  const transform = useCallback((values: SolicitudFormValues) => {
    console.log("🔍 TRANSFORM INPUT:", JSON.stringify(values, null, 2));
    console.log("🔍 VALUES ID:", values.id, typeof values.id);
    const { header, detalles } = normalizeSolicitudValues(values);
    detalleBuffer.current = detalles;
    const result = {
      ...header,
      id: values.id,
    };
    console.log("🔍 TRANSFORM OUTPUT:", JSON.stringify(result, null, 2));
    console.log("🔍 TRANSFORM OUTPUT ID:", result.id, typeof result.id);
    console.log("🔍 DETALLES BUFFER:", JSON.stringify(detalles, null, 2));
    console.log("🔍 ESTE OBJETO SE ENVIARÁ AL BACKEND PUT /solicitudes/" + result.id);
    return result;
  }, []);

  const mutationOptions = {
    onSuccess: async (record: RaRecord) => {
      console.log("✅ UPDATE SUCCESS - Record recibido del backend:", JSON.stringify(record, null, 2));
      try {
        const solicitudId = record.id;
        if (solicitudId != null) {
          console.log("🔄 Sincronizando detalles para solicitud:", solicitudId);
          await syncSolicitudDetalles(
            dataProvider,
            solicitudId,
            detalleBuffer.current,
          );
          console.log("✅ Detalles sincronizados correctamente");
          
          // CRÍTICO: Recargar el registro completo del backend para actualizar el caché
          console.log("🔄 Recargando registro completo del backend...");
          const { data: updatedRecord } = await dataProvider.getOne("solicitudes", { id: solicitudId });
          console.log("✅ Registro recargado:", JSON.stringify(updatedRecord, null, 2));
        }
        notify("Solicitud actualizada correctamente", { type: "success" });
      } catch (error) {
        console.error("❌ Error sincronizando detalles:", error);
        notify(
          getErrorMessage(error, "Solicitud actualizada pero hubo un error al sincronizar los detalles"),
          { type: "warning" },
        );
        // No lanzamos el error para permitir el redirect
      } finally {
        detalleBuffer.current = [];
      }
    },
    onError: (error: unknown) => {
      detalleBuffer.current = [];
      notify(
        getErrorMessage(error, "No se pudo actualizar la solicitud"),
        { type: "error" },
      );
    },
  };

  return (
    <Edit
      redirect="list"
      title="Editar solicitud"
      transform={transform}
      mutationOptions={mutationOptions}
    >
      <SolicitudForm isEdit />
    </Edit>
  );
};
