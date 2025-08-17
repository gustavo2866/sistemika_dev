import { z } from "zod";

export const exampleFormSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  email: z.string().email({ message: "Correo electrónico inválido" }),
  role: z.string().min(1, { message: "Debes seleccionar un rol" }),
  subscribe: z.boolean().optional(),
  notes: z.string().max(500, { message: "Las notas no pueden superar los 500 caracteres" }).optional(),
});

export type ExampleFormData = z.infer<typeof exampleFormSchema>;
