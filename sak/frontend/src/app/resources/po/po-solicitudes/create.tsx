"use client";

import { Create } from "@/components/create";
import { useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { PoSolicitudForm } from "./form";

export const PoSolicitudCreate = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const wizardParam = params.get("wizard");
  const [wizardOpen, setWizardOpen] = useState(Boolean(wizardParam));

  useEffect(() => {
    if (wizardParam) {
      setWizardOpen(true);
    }
  }, [wizardParam]);

  return (
    <Create
      redirect={false}
      title="Nueva Solicitud"
      className="w-full max-w-lg"
      actions={null}
    >
      <div className="w-full max-w-lg">
        <PoSolicitudForm
          wizardOpen={wizardOpen}
          setWizardOpen={setWizardOpen}
          wizardVariant={wizardParam}
        />
      </div>
    </Create>
  );
};

