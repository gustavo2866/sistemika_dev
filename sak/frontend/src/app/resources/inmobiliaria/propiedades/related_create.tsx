"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  ResourceContextProvider,
  useNotify,
} from "ra-core";
import { useFormContext } from "react-hook-form";

import { ContactoDialog } from "@/app/resources/crm/crm-contactos/contacto_dialog";
import { EmprendimientoDialog } from "@/app/resources/inmobiliaria/emprendimientos/emprendimiento_dialog";
import { PropietarioCreate } from "@/app/resources/inmobiliaria/propietarios/create";
import { resolveNumericId } from "@/components/forms/form_order";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { PROPIEDAD_DIALOG_OVERLAY_CLASS } from "./dialog_styles";
import type { PropiedadFormValues } from "./model";

type PropiedadRelatedCreateEntity = "propietario" | "contacto" | "emprendimiento";

type PropiedadRelatedCreateRecord = Record<string, unknown> & {
  id?: unknown;
};

type PropiedadRelatedCreateContextValue = {
  contactoRefreshKey: string;
  emprendimientoRefreshKey: string;
  propietarioRefreshKey: string;
  openDialog: (entity: PropiedadRelatedCreateEntity) => void;
};

const PropiedadRelatedCreateContext = createContext<PropiedadRelatedCreateContextValue | null>(null);

export const usePropiedadRelatedCreate = () => {
  const context = useContext(PropiedadRelatedCreateContext);

  if (!context) {
    throw new Error("usePropiedadRelatedCreate must be used within PropiedadRelatedCreateProvider");
  }

  return context;
};

export const PropiedadRelatedCreateProvider = ({ children }: { children: ReactNode }) => {
  const notify = useNotify();
  const { setValue } = useFormContext<PropiedadFormValues>();
  const [activeDialog, setActiveDialog] = useState<PropiedadRelatedCreateEntity | null>(null);
  const [propietarioRefreshKey, setPropietarioRefreshKey] = useState("base");
  const [contactoRefreshKey, setContactoRefreshKey] = useState("base");
  const [emprendimientoRefreshKey, setEmprendimientoRefreshKey] = useState("base");
  const portalContainer =
    typeof document !== "undefined"
      ? document.getElementById("propiedad-form-shell") ?? document.getElementById("admin-content")
      : null;

  const closeDialog = () => setActiveDialog(null);

  const handleCreated = (
    entity: PropiedadRelatedCreateEntity,
    record: PropiedadRelatedCreateRecord,
  ) => {
    const createdId = resolveNumericId(record?.id);
    const nextRefreshKey = Date.now().toString();

    if (entity === "propietario") {
      setPropietarioRefreshKey(nextRefreshKey);
      if (createdId) {
        setValue("propietario_id", createdId, { shouldDirty: true, shouldValidate: true });
      }
      notify("Propietario creado", { type: "info" });
    }

    if (entity === "contacto") {
      setContactoRefreshKey(nextRefreshKey);
      if (createdId) {
        setValue("contacto_id", createdId, { shouldDirty: true, shouldValidate: true });
      }
      notify("Contacto creado", { type: "info" });
    }

    if (entity === "emprendimiento") {
      setEmprendimientoRefreshKey(nextRefreshKey);
      if (createdId) {
        setValue("emprendimiento_id", createdId, { shouldDirty: true, shouldValidate: true });
      }
      notify("Emprendimiento creado", { type: "info" });
    }

    closeDialog();
  };

  return (
    <PropiedadRelatedCreateContext.Provider
      value={{
        contactoRefreshKey,
        emprendimientoRefreshKey,
        propietarioRefreshKey,
        openDialog: setActiveDialog,
      }}
    >
      {children}
      <PropiedadRelatedCreateDialog
        open={activeDialog === "propietario"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title="Crear propietario"
        description="Alta rapida de propietario sin salir del formulario de la propiedad."
        className="sm:max-w-4xl"
      >
        <ResourceContextProvider value="propietarios">
          <PropietarioCreate
            embedded
            onCreated={(record) => handleCreated("propietario", record)}
          />
        </ResourceContextProvider>
      </PropiedadRelatedCreateDialog>
      <ContactoDialog
        contained
        contentClassName="sm:max-w-6xl"
        open={activeDialog === "contacto"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        onCreated={(record) => handleCreated("contacto", record)}
        overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
        portalContainer={portalContainer}
      />
      <EmprendimientoDialog
        contained
        contentClassName="sm:max-w-6xl"
        open={activeDialog === "emprendimiento"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        onCreated={(record) => handleCreated("emprendimiento", record)}
        overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
        portalContainer={portalContainer}
      />
    </PropiedadRelatedCreateContext.Provider>
  );
};

const PropiedadRelatedCreateDialog = ({
  children,
  className,
  description,
  onOpenChange,
  open,
  title,
}: {
  children: ReactNode;
  className?: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className={cn("flex max-h-[90vh] flex-col overflow-hidden p-0", className)}
      overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
    >
      <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-6">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto px-6 pb-6 pt-4 overscroll-contain">{children}</div>
    </DialogContent>
  </Dialog>
);
