import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Renderiza el contenedor visual principal donde vive el contenido del setup.
export const SetupContentPanel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={cn(
      "min-h-[420px] px-5 py-5 sm:px-6",
      className,
    )}
  >
    {children}
  </section>
);
