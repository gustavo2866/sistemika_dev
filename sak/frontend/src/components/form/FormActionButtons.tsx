"use client";

import { Button } from "@/components/ui/button";
import { Save, X } from "lucide-react";

type FormActionButtonsProps = {
  onCancel: () => void;
  onSave: () => void;
  loading?: boolean;
  cancelText?: string;
  saveText?: string;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Botones de acción de formulario (Guardar/Cancelar) con estilo sticky
 * 
 * @example
 * ```tsx
 * <FormActionButtons
 *   onCancel={() => navigate("/solicitudes")}
 *   onSave={handleSave}
 *   loading={loading}
 * />
 * ```
 */
export const FormActionButtons = ({
  onCancel,
  onSave,
  loading = false,
  cancelText = "Cancelar",
  saveText = "Guardar",
  loadingText = "Guardando...",
  disabled = false,
  className = "",
}: FormActionButtonsProps) => {
  return (
    <div className={`flex justify-end gap-3 sticky bottom-4 bg-background/95 backdrop-blur-sm p-4 rounded-lg border ${className}`}>
      <Button 
        variant="outline" 
        onClick={onCancel} 
        disabled={loading || disabled}
      >
        <X className="h-4 w-4 mr-2" />
        {cancelText}
      </Button>
      <Button 
        onClick={onSave} 
        disabled={loading || disabled}
      >
        <Save className="h-4 w-4 mr-2" />
        {loading ? loadingText : saveText}
      </Button>
    </div>
  );
};
