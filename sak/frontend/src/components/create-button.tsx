import React from "react";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Translate, useCreatePath, useResourceContext } from "ra-core";
import { Link } from "react-router";

export type CreateButtonProps = {
  label?: string;
  resource?: string;
  state?: Record<string, unknown>;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

export const CreateButton = ({
  label,
  resource: targetResource,
  state,
  size,
  className,
}: CreateButtonProps) => {
  const resource = useResourceContext();
  const createPath = useCreatePath();
  const link = createPath({
    resource: targetResource ?? resource,
    type: "create",
  });
  return (
    <Link
      className={buttonVariants({ variant: "outline", size, className })}
      to={link}
      state={state}
      onClick={stopPropagation}
    >
      <Plus />
      <Translate i18nKey={label ?? "ra.action.create"}>
        {label ?? "Create"}
      </Translate>
    </Link>
  );
};

// useful to prevent click bubbling in a datagrid with rowClick
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
