"use client";

import { Create } from "@/components/create";
import { ClipboardList } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  loadDashboardReturnMarker,
  saveDashboardReturnMarker,
} from "../po-dashboard/return-state";
import { PoOrderForm } from "./form";
import { normalizePoOrderPayload, TIPO_COMPRA_CHOICES } from "./model";

type PoOrderTipoCompra = (typeof TIPO_COMPRA_CHOICES)[number]["id"];

const getTipoCompraLabel = (tipoCompra: PoOrderTipoCompra) =>
  TIPO_COMPRA_CHOICES.find((choice) => choice.id === tipoCompra)?.name ?? "Normal";

const PoOrderTipoCompraHeader = ({ tipoCompra }: { tipoCompra: PoOrderTipoCompra }) => (
  <Badge variant="outline" className="text-[11px]">
    {getTipoCompraLabel(tipoCompra)}
  </Badge>
);

export const PoOrderCreate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");
  const initialTipoCompra: PoOrderTipoCompra =
    params.get("tipo_compra") === "directa" ? "directa" : "normal";

  return (
    <Create
      redirect={false}
      title={
        <span className="flex w-full items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Crear Orden
          </span>
          <PoOrderTipoCompraHeader tipoCompra={initialTipoCompra} />
        </span>
      }
      transform={(data: any) => normalizePoOrderPayload(data)}
      mutationOptions={{
        onSuccess: () => {
          if (returnTo) {
            const existingReturnMarker = loadDashboardReturnMarker(returnTo);
            saveDashboardReturnMarker(returnTo, {
              ...existingReturnMarker,
              savedAt: Date.now(),
              refreshAll: true,
            });
            navigate(returnTo);
            return;
          }
          navigate("/po-orders");
        },
      }}
    >
      <PoOrderForm initialTipoCompra={initialTipoCompra} />
    </Create>
  );
};
