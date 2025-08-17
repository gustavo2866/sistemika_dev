import React from "react";

// Contenedor general de un campo
// Espacio entre componentes (campo anterior y label del siguiente)
const FIELD_SPACING = "mb-4 last:mb-0"; // Espacio más natural entre componentes, sin margen en el último campo
export function FormField({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`${FIELD_SPACING} ${className ?? ""}`}>{children}</div>;
}

// Agrupa elementos internos de un campo (label, control, mensajes)
export function FormItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className ?? ""}`}>{children}</div>;
}

// Etiqueta con soporte para asterisco si el campo es requerido
// Espacio entre label y su propio campo
const LABEL_SPACING = "mb-4"; // Mayor espacio entre label y campo
export function FormLabel({
  children, htmlFor, required, className,
}: { children: React.ReactNode; htmlFor?: string; required?: boolean; className?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`inline-flex items-baseline gap-1 text-sm font-medium ${LABEL_SPACING} ${className ?? ""}`}
    >
      <span>{children}</span>
      {required && (
        <span aria-hidden="true" className="text-destructive">*</span>
      )}
    </label>
  );
} 

// Contenedor del input/select/textarea
export function FormControl({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

// Mensaje de error en rojo (evitar duplicados)
export function FormMessage({
  children,
  error,
  id,
  className,
}: {
  children?: React.ReactNode;
  error?: string;
  id?: string;
  className?: string;
}) {
  const content = children ?? error;
  if (!content) return null;

  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={["mt-1 block text-sm text-destructive", className].filter(Boolean).join(" ")}
    >
      {content}
    </p>
  );
}

// Texto descriptivo en gris
export function FormDescription({ children, id, className }: { children: React.ReactNode; id?: string; className?: string }) {
  return (
    <span id={id} className={`text-gray-500 text-xs ${className ?? ""}`}>
      {children}
    </span>
  );
}

// Wrapper de cabecera para títulos
export function FormHeader({ title, className }: { title: string; className?: string }) {
  return (
    <div className={`mb-4 border-b border-gray-300 ${className ?? ""}`}>
      <h2 className="text-lg font-semibold text-gray-900 pb-2">{title}</h2>
    </div>
  );
}

// Footer con botones alineados a la derecha
export function FormFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex justify-end gap-2 mt-6 ${className ?? ""}`}>
      {children}
    </div>
  );
}

// Botón por defecto uniforme
export function FormButton({ children, variant = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" }) {
  const base =
    "px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 min-w-[100px]";
  const variants: Record<string, string> = {
    default: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-400",
  };
  return (
    <button className={`${base} ${variants[variant]}`} {...props}>
      {children}
    </button>
  );
}
