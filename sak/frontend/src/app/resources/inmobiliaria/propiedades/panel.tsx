"use client";

import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { ListBase } from "ra-core";
import { ListPaginator } from "@/components/forms/form_order";
import { ListView } from "@/components/list";
import { Button } from "@/components/ui/button";
import { AccionesLista, LIST_FILTERS, PropiedadesListContent } from "./List";

export const PropiedadesPanel = () => (
  <ListBase debounce={300} perPage={10} sort={{ field: "id", order: "DESC" }}>
    <PropiedadesPanelContent />
  </ListBase>
);

const PropiedadesListTitle = ({ onBack }: { onBack: () => void }) => (
  <>
    <div className="sm:hidden">
      <Button
        type="button"
        variant="ghost"
        className="h-7 px-1.5 text-[11px] font-medium text-primary"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Volver
      </Button>
      <div className="-mt-0.5 flex items-center justify-center gap-2">
        <Home className="h-4 w-4" />
        <span>Propiedades</span>
      </div>
    </div>
    <span className="hidden items-center gap-3 sm:inline-flex">
      <Button
        type="button"
        variant="ghost"
        className="h-8 px-2 text-sm font-medium text-primary"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Volver
      </Button>
      <span className="inline-flex items-center gap-2">
        <Home className="h-4 w-4" />
        Propiedades
      </span>
    </span>
  </>
);

const PropiedadesPanelContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const queryReturnTo = params.get("returnTo") ?? undefined;

  const handleBack = () => {
    const stateReturnTo =
      (location.state as { returnTo?: string | null } | null)?.returnTo ?? undefined;
    if (stateReturnTo) {
      navigate(stateReturnTo);
      return;
    }
    if (queryReturnTo) {
      navigate(queryReturnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/propiedades-dashboard");
  };

  return (
    <ListView
      title={<PropiedadesListTitle onBack={handleBack} />}
      actions={<AccionesLista />}
      filters={LIST_FILTERS}
      containerClassName="max-w-[980px] w-full mr-auto"
      pagination={<ListPaginator />}
    >
      <PropiedadesListContent />
    </ListView>
  );
};
