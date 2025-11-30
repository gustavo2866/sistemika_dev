import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDataProvider, useGetIdentity, useNotify } from "ra-core";
import { useFormContext } from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { useAutoInitializeField } from "@/components/forms";
import { OPORTUNIDAD_CREAR_DEFAULTS } from "./oportunidad-crear.model";

type OportunidadCrearProps = {
  mensajeId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactoNombre: string;
  contactoEditable: boolean;
  contactoReferencia?: string | null;
  defaultResponsableId?: number | null;
  defaultTipoOperacionId?: number | null;
  onCreated?: () => void;
};

const FormContent = ({ 
  contactName, 
  setContactName, 
  contactoEditable,
  oportunidadNombre,
  setOportunidadNombre,
  descripcion,
  setDescripcion,
  confirmButtonRef,
  canSubmit,
  loading,
  onCancel,
  ventaId,
}: {
  contactName: string;
  setContactName: (value: string) => void;
  contactoEditable: boolean;
  oportunidadNombre: string;
  setOportunidadNombre: (value: string) => void;
  descripcion: string;
  setDescripcion: (value: string) => void;
  confirmButtonRef: React.RefObject<HTMLButtonElement>;
  canSubmit: boolean;
  loading: boolean;
  onCancel: () => void;
  ventaId: number | null;
}) => {
  const { setValue, watch } = useFormContext();
  
  // Auto-inicializar responsable con el usuario logueado
  useAutoInitializeField("responsable_id", "id", true);
  
  // Auto-inicializar tipo de operación con "Venta"
  const tipoOperacionValue = watch("tipo_operacion_id");
  useEffect(() => {
    if (ventaId && !tipoOperacionValue) {
      setValue("tipo_operacion_id", ventaId, { shouldDirty: false });
    }
  }, [ventaId, tipoOperacionValue, setValue]);

  return (
    <>
      <div className="space-y-5 py-2">
        <div className="grid gap-4 rounded-2xl border border-border/50 bg-background/80 p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Nombre del contacto
            </label>
            <Input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              readOnly={!contactoEditable}
              tabIndex={contactoEditable ? 0 : -1}
              className="h-10 bg-background"
              placeholder="Nombre completo"
            />
          </div>
          <div className="[&_.MuiFormControl-root]:w-full [&_.MuiFormLabel-root]:text-xs [&_.MuiFormLabel-root]:font-medium [&_.MuiFormLabel-root]:uppercase [&_.MuiFormLabel-root]:tracking-wide [&_.MuiFormLabel-root]:text-muted-foreground [&_.MuiFormHelperText-root]:hidden [&_.MuiInputBase-root]:h-10 [&_.MuiInputBase-root]:mt-1.5 [&_.MuiInputBase-root]:rounded-md [&_.MuiInputBase-root]:border [&_.MuiInputBase-root]:border-input [&_.MuiInputBase-root]:bg-background [&_.MuiInputBase-input]:py-0 [&_.MuiInputBase-input]:text-sm">
            <ReferenceInput
              source="tipo_operacion_id"
              reference="crm/catalogos/tipos-operacion"
              label="Tipo de operación"
            >
              <SelectInput optionText="nombre" emptyText="Seleccionar tipo" />
            </ReferenceInput>
          </div>
          <div className="[&_.MuiFormControl-root]:w-full [&_.MuiFormLabel-root]:text-xs [&_.MuiFormLabel-root]:font-medium [&_.MuiFormLabel-root]:uppercase [&_.MuiFormLabel-root]:tracking-wide [&_.MuiFormLabel-root]:text-muted-foreground [&_.MuiFormHelperText-root]:hidden [&_.MuiInputBase-root]:h-10 [&_.MuiInputBase-root]:mt-1.5 [&_.MuiInputBase-root]:rounded-md [&_.MuiInputBase-root]:border [&_.MuiInputBase-root]:border-input [&_.MuiInputBase-root]:bg-background [&_.MuiInputBase-input]:py-0 [&_.MuiInputBase-input]:text-sm">
            <ReferenceInput
              source="emprendimiento_id"
              reference="emprendimientos"
              label="Emprendimiento (opcional)"
            >
              <SelectInput optionText="nombre" emptyText="Sin emprendimiento" />
            </ReferenceInput>
          </div>
          <div className="[&_.MuiFormControl-root]:w-full [&_.MuiFormLabel-root]:text-xs [&_.MuiFormLabel-root]:font-medium [&_.MuiFormLabel-root]:uppercase [&_.MuiFormLabel-root]:tracking-wide [&_.MuiFormLabel-root]:text-muted-foreground [&_.MuiFormHelperText-root]:hidden [&_.MuiInputBase-root]:h-10 [&_.MuiInputBase-root]:mt-1.5 [&_.MuiInputBase-root]:rounded-md [&_.MuiInputBase-root]:border [&_.MuiInputBase-root]:border-input [&_.MuiInputBase-root]:bg-background [&_.MuiInputBase-input]:py-0 [&_.MuiInputBase-input]:text-sm">
            <ReferenceInput
              source="responsable_id"
              reference="users"
              label="Responsable"
            >
              <SelectInput optionText="nombre" emptyText="Seleccionar responsable" />
            </ReferenceInput>
          </div>
        </div>
        <div className="space-y-1.5 rounded-2xl border border-border/40 bg-background/80 p-4">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Nombre de la oportunidad
          </label>
          <Input
            value={oportunidadNombre}
            onChange={(event) => setOportunidadNombre(event.target.value)}
            placeholder="Ej: Visita inicial - Torre Central"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5 rounded-2xl border border-border/40 bg-background/80 p-4">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Descripción de la oportunidad
          </label>
          <Textarea
            rows={6}
            className="min-h-[180px] resize-none"
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            placeholder="Agrega notas breves que ayuden a contextualizar la necesidad del cliente."
          />
        </div>
      </div>
      <DialogFooter className="mt-6">
        <Button 
          type="button"
          variant="ghost" 
          onClick={onCancel} 
          disabled={loading}
          className="h-10"
        >
          Cancelar
        </Button>
        <Button
          ref={confirmButtonRef}
          type="submit"
          disabled={!canSubmit || loading}
          className="h-10 min-w-[100px]"
        >
          {loading ? "Creando..." : "Confirmar"}
        </Button>
      </DialogFooter>
    </>
  );
};

export const OportunidadCrear = ({
  mensajeId,
  open,
  onOpenChange,
  contactoNombre,
  contactoEditable,
  contactoReferencia,
  defaultResponsableId,
  defaultTipoOperacionId,
  onCreated,
}: OportunidadCrearProps) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const { data: identity } = useGetIdentity();
  const confirmButtonRef = useRef<HTMLButtonElement>(null) as React.RefObject<HTMLButtonElement>;

  const [contactName, setContactName] = useState(contactoNombre);
  const [oportunidadNombre, setOportunidadNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [loading, setLoading] = useState(false);
  const [ventaId, setVentaId] = useState<number | null>(null);

  // Buscar el ID del tipo de operación "Venta" al abrir el diálogo
  useEffect(() => {
    if (!open || ventaId !== null) return;
    
    const fetchVentaId = async () => {
      try {
        const { data } = await dataProvider.getList("crm/catalogos/tipos-operacion", {
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
          filter: {},
        });
        const venta = data.find((tipo: any) => 
          tipo.nombre?.toLowerCase() === "venta" || tipo.codigo?.toLowerCase() === "venta"
        );
        if (venta) {
          setVentaId(venta.id);
        }
      } catch (error) {
        console.warn("No se pudo cargar el tipo de operación Venta:", error);
      }
    };
    
    fetchVentaId();
  }, [open, ventaId, dataProvider]);

  // Valores por defecto para el formulario
  const defaultValues = useMemo(() => ({
    tipo_operacion_id: defaultTipoOperacionId ?? ventaId ?? null,
    emprendimiento_id: null,
    responsable_id: defaultResponsableId ?? identity?.id ?? null,
  }), [defaultTipoOperacionId, ventaId, defaultResponsableId, identity?.id]);

  useEffect(() => {
    if (open) {
      setContactName(contactoNombre);
      setOportunidadNombre("");
      setDescripcion("");
    }
  }, [open, contactoNombre]);

  const handleSubmit = async (formData: any) => {
    if (loading) return;
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        nombre_oportunidad: oportunidadNombre.trim(),
        tipo_operacion_id: formData.tipo_operacion_id,
        responsable_id: formData.responsable_id,
        descripcion: descripcion.trim() || null,
        emprendimiento_id: formData.emprendimiento_id || null,
      };
      if (contactoEditable) {
        payload.contacto_nombre = contactName.trim();
      } else {
        payload.contacto_nombre = contactName;
      }
      if (contactoReferencia) {
        payload.contacto_referencia = contactoReferencia;
      }

      await dataProvider.create(`crm/mensajes/${mensajeId}/crear-oportunidad`, {
        data: payload,
      });
      notify("Oportunidad creada correctamente", { type: "success" });
      onOpenChange(false);
      onCreated?.();
    } catch (error: any) {
      console.error(error);
      notify(error?.body?.detail ?? error?.message ?? "No se pudo crear la oportunidad", {
        type: "warning",
      });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = useMemo(() => {
    const hasContacto = contactoEditable ? Boolean(contactName.trim()) : true;
    return hasContacto && Boolean(oportunidadNombre.trim());
  }, [contactName, contactoEditable, oportunidadNombre]);

  return (
    <Dialog open={open} onOpenChange={(value) => !loading && onOpenChange(value)}>
      <DialogContent
        className="sm:max-w-xl bg-gradient-to-b from-background to-muted/20"
        onOpenAutoFocus={(event) => {
          if (!contactoEditable && confirmButtonRef.current) {
            event.preventDefault();
            confirmButtonRef.current.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Crear oportunidad</DialogTitle>
          <DialogDescription>
            Crea una nueva oportunidad desde este mensaje.
          </DialogDescription>
        </DialogHeader>
        <SimpleForm onSubmit={handleSubmit} defaultValues={defaultValues} toolbar={false}>
          <FormContent
            contactName={contactName}
            setContactName={setContactName}
            contactoEditable={contactoEditable}
            oportunidadNombre={oportunidadNombre}
            setOportunidadNombre={setOportunidadNombre}
            descripcion={descripcion}
            setDescripcion={setDescripcion}
            confirmButtonRef={confirmButtonRef}
            canSubmit={canSubmit}
            loading={loading}
            onCancel={() => onOpenChange(false)}
            ventaId={ventaId}
          />
        </SimpleForm>
      </DialogContent>
    </Dialog>
  );
};
