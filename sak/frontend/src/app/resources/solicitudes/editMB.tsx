"use client";

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useDataProvider, useNotify, RecordContextProvider } from "ra-core";
import { SolicitudFormMB } from "./formMB";

export const SolicitudEditMB = () => {
  const { id } = useParams<{ id: string }>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchRecord = async () => {
      try {
        setLoading(true);
        const { data } = await dataProvider.getOne("solicitudes", { id });
        setRecord(data);
      } catch (error) {
        notify("Error al cargar la solicitud", { type: "error" });
        console.error("Error fetching record:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [id, dataProvider, notify]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando solicitud...</p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-medium text-destructive">No se encontró la solicitud</p>
        </div>
      </div>
    );
  }

  return (
    <RecordContextProvider value={record}>
      <SolicitudFormMB />
    </RecordContextProvider>
  );
};
