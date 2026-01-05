import { cn } from "@/lib/utils";
import {
  ComboboxQuery,
  type ComboboxQueryProps,
} from "@/components/forms/combobox-query";

const compactComboboxClass =
  "h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm [&_span]:text-[11px] sm:[&_span]:text-sm";

export const CompactComboboxQuery = (props: ComboboxQueryProps) => {
  return (
    <ComboboxQuery
      {...props}
      className={cn(compactComboboxClass, props.className)}
    />
  );
};
