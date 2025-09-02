import { CircleX } from "lucide-react";
import { Translate } from "ra-core";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";

export function CancelButton(props: React.ComponentProps<"button">) {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      onClick={() => navigate(-1)}
      className="cursor-pointer"
      {...props}
    >
      <CircleX className="h-4 w-4 mr-2" />
      <Translate i18nKey="ra.action.cancel">Cancelar</Translate>
    </Button>
  );
}
