import * as React from "react";
import { Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { humanize, singularize } from "inflection";
import {
  useDeleteWithUndoController,
  useGetRecordRepresentation,
  useResourceTranslation,
  useRecordContext,
  useResourceContext,
  useTranslate,
  type UseDeleteOptions,
  type RedirectionSideEffect,
} from "ra-core";

export type DeleteButtonProps = {
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  onClick?: React.ReactEventHandler<HTMLButtonElement>;
  mutationOptions?: UseDeleteOptions;
  redirect?: RedirectionSideEffect;
  resource?: string;
  successMessage?: string;
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
};

export const DeleteButton = (props: DeleteButtonProps) => {
  const {
    label: labelProp,
    onClick,
    size,
    mutationOptions,
    redirect = "list",
    successMessage,
    variant = "outline",
    className: classNameProp,
  } = props;
  const baseClassName =
    classNameProp ??
    "cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40";
  const resolvedSize = size ?? "sm";
  const resolvedClassName = cn(
    size == null && "h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm",
    baseClassName
  );
  const record = useRecordContext(props);
  const resource = useResourceContext(props);

  const { isPending, handleDelete } = useDeleteWithUndoController({
    record,
    resource,
    redirect,
    onClick,
    mutationOptions,
    successMessage,
  });
  const translate = useTranslate();
  const getRecordRepresentation = useGetRecordRepresentation(resource);
  let recordRepresentation = getRecordRepresentation(record);
  const resourceName = translate(`resources.${resource}.forcedCaseName`, {
    smart_count: 1,
    _: humanize(
      translate(`resources.${resource}.name`, {
        smart_count: 1,
        _: resource ? singularize(resource) : undefined,
      }),
      true,
    ),
  });
  // We don't support React elements for this
  if (React.isValidElement(recordRepresentation)) {
    recordRepresentation = `#${record?.id}`;
  }
  const label = useResourceTranslation({
    resourceI18nKey: `resources.${resource}.action.delete`,
    baseI18nKey: "ra.action.delete",
    options: {
      name: resourceName,
      recordRepresentation,
    },
    userText: labelProp,
  });

  return (
    <Button
      variant={variant}
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      aria-label={typeof label === "string" ? label : undefined}
      size={resolvedSize}
      className={resolvedClassName}
    >
      <Trash className="size-3 sm:size-4" />
      {label}
    </Button>
  );
};
