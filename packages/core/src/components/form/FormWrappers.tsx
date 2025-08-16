import React from "react";
// Ejemplo: wrappers de shadcn/ui para campos de formulario
export function FormField({ children }: { children: React.ReactNode }) {
  return <div className="mb-4">{children}</div>;
}
export function FormItem({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}
export function FormLabel({ children }: { children: React.ReactNode }) {
  return <label className="block font-medium text-sm mb-0.5">{children}</label>;
}
export function FormControl({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
export function FormMessage({ children }: { children: React.ReactNode }) {
  return <span className="text-red-500 text-xs mt-1 block">{children}</span>;
}
export function FormDescription({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-500 text-xs">{children}</span>;
}
