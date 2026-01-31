"use client";

import { Create } from "@/components/create";
import { PoOrdenCompraForm } from "./form";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

export const PoOrdenCompraCreate = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const wizardParam = params.get("wizard");
  const wizardVariant = wizardParam === "solicitud" ? "solicitud" : "asistida";
  const [wizardOpen, setWizardOpen] = useState(Boolean(wizardParam));
  const redirectTo = useMemo(() => {
    return params.get("returnTo") ?? "list";
  }, [location.search]);

  useEffect(() => {
    if (wizardParam) {
      setWizardOpen(true);
    }
  }, [wizardParam]);

  return (
    <Create
      redirect={redirectTo}
      title="Nueva Orden de Compra"
      className="w-full max-w-lg"
      actions={null}
    >
      <div className="w-full max-w-lg">
        <PoOrdenCompraForm
          wizardOpen={wizardOpen}
          setWizardOpen={setWizardOpen}
          wizardVariant={wizardVariant}
        />
      </div>
    </Create>
  );
};
