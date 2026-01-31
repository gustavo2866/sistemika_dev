import { SelectInput, type SelectInputProps } from "@/components/select-input";
import { required } from "ra-core";
import { cn } from "@/lib/utils";

type SelectTriggerProps = SelectInputProps["triggerProps"];
type CompactSelectInputProps = SelectInputProps & { required?: boolean };

const compactTriggerClass =
  "!h-7 px-2 text-[11px] sm:!h-8 sm:px-3 sm:text-sm [&_[data-slot=select-value]]:text-[11px] sm:[&_[data-slot=select-value]]:text-sm data-[size=default]:!h-7 sm:data-[size=default]:!h-8 data-[size=sm]:!h-7 sm:data-[size=sm]:!h-8";

export const CompactSelectInput = ({
  triggerProps,
  required: isRequired,
  validate,
  className,
  ...props
}: CompactSelectInputProps) => {
  const nextValidate = isRequired
    ? validate
      ? Array.isArray(validate)
        ? [required(), ...validate]
        : [required(), validate]
      : required()
    : validate;
  const nextTriggerProps: SelectTriggerProps = {
    ...triggerProps,
    className: cn(compactTriggerClass, triggerProps?.className),
    size: "sm" as const,
  };

  return (
    <SelectInput
      {...props}
      className={cn("w-full", className)}
      validate={nextValidate}
      triggerProps={nextTriggerProps}
    />
  );
};
