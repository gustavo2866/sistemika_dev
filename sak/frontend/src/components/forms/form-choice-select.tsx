import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField, type FormFieldError } from "./form-field";

type ChoiceRecord = Record<string, unknown> & {
  id?: string | number;
  name?: string;
};

type OptionResolver<TChoice extends ChoiceRecord> = (
  choice: TChoice
) => string;

interface FormChoiceSelectProps<TChoice extends ChoiceRecord> {
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
}

export const FormChoiceSelect = <TChoice extends ChoiceRecord>({
  label,
  choices,
  value,
  onChange,
  placeholder = "Selecciona una opción",
  error,
  required,
  disabled,
  getOptionLabel = (choice) => String(choice.name ?? choice.id ?? ""),
  getOptionValue = (choice) => String(choice.id ?? ""),
  className,
}: FormChoiceSelectProps<TChoice>) => {
  const normalizedValue =
    value === null || value === undefined ? undefined : String(value);

  return (
    <FormField
      label={label}
      error={error}
      required={required}
      className={className}
    >
      <Select
        value={normalizedValue}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger>
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
    </FormField>
  );
};
