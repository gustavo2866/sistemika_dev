import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompactFormField } from "@/components/forms";
import type { FormFieldError } from "@/components/forms/form-field";
import { cn } from "@/lib/utils";

type ChoiceRecord = Record<string, unknown> & {
  id?: string | number;
  name?: string;
};

type OptionResolver<TChoice extends ChoiceRecord> = (choice: TChoice) => string;

interface CompactRadixSelectProps<TChoice extends ChoiceRecord> {
  label: string;
  choices: TChoice[];
  value?: string | number | null;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: FormFieldError;
  required?: boolean;
  disabled?: boolean;
  getOptionLabel?: OptionResolver<TChoice>;
  getOptionValue?: OptionResolver<TChoice>;
  className?: string;
  triggerClassName?: string;
}

const compactTriggerClass =
  "!h-7 !min-h-[1.75rem] !px-2 !py-1 text-[11px] sm:!h-8 sm:!min-h-[2rem] sm:!px-3 sm:!py-1.5 sm:text-sm w-full";

export const CompactRadixSelect = <TChoice extends ChoiceRecord>({
  label,
  choices,
  value,
  onChange,
  placeholder = "Selecciona una opcion",
  error,
  required,
  disabled,
  getOptionLabel = (choice) => String(choice.name ?? choice.id ?? ""),
  getOptionValue = (choice) => String(choice.id ?? ""),
  className,
  triggerClassName,
}: CompactRadixSelectProps<TChoice>) => {
  const normalizedValue =
    value === null || value === undefined ? undefined : String(value);

  return (
    <CompactFormField
      label={label}
      error={error}
      required={required}
      className={className}
    >
      <Select value={normalizedValue} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          size="sm"
          className={cn(compactTriggerClass, triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => {
            const optionValue = getOptionValue(choice);
            return (
              <SelectItem key={optionValue} value={optionValue}>
                {getOptionLabel(choice)}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </CompactFormField>
  );
};
