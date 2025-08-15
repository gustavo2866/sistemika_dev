import { Button } from "@workspace/ui/components/button";
import type { FC } from "react";

const Page: FC = () => {
  return (
    <div className="flex items-center justify-center min-h-svh">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">¡Bienvenido a app2!</h1>
        <Button size="sm">Botón UI</Button>
      </div>
    </div>
  );
}

export default Page;
