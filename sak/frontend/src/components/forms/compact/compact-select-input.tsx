import { SelectInput, type SelectInputProps } from "@/components/select-input";
import { cn } from "@/lib/utils";

type SelectTriggerProps = SelectInputProps["triggerProps"];

const compactTriggerClass =
  "h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm [&_[data-slot=select-value]]:text-[11px] sm:[&_[data-slot=select-value]]:text-sm";

export const CompactSelectInput = ({
  triggerProps,
  ...props
}: SelectInputProps) => {
  const nextTriggerProps: SelectTriggerProps = {
    ...triggerProps,
    className: cn(compactTriggerClass, triggerProps?.className),
  };

  return <SelectInput {...props} triggerProps={nextTriggerProps} />;
};
