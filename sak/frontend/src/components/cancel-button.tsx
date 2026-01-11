import { CircleX } from "lucide-react";
import { Translate } from "ra-core";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";

export function CancelButton(props: React.ComponentProps<"button">) {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => navigate(-1)}
      className="h-7 px-2 text-[11px] sm:h-9 sm:px-4 sm:text-sm cursor-pointer"
      {...props}
    >
      <CircleX className="size-3 sm:size-4" />
      <Translate i18nKey="ra.action.cancel">Cancel</Translate>
    </Button>
  );
}

