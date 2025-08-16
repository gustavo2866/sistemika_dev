import { z } from "zod";

export const exampleFormSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.string(),
  subscribe: z.boolean().optional(),
  notes: z.string().optional(),
});

export type ExampleFormData = z.infer<typeof exampleFormSchema>;
