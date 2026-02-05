import { useEffect, useMemo } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { CompactComboboxQuery } from "./compact-combobox-query";
import type { ComboboxQueryProps } from "../combobox-query";
import { LineDeleteButton } from "../line-delete-button";

type CompactMultiSelectFieldProps = {
  name: string;
  valueKey?: string;
  placeholder?: string;
  minItems?: number;
  disableDuplicates?: boolean;
  clearable?: boolean;
  filter?: ComboboxQueryProps["filter"];
  dependsOn?: ComboboxQueryProps["dependsOn"];
  comboboxProps: Omit<ComboboxQueryProps, "value" | "onChange" | "filter" | "dependsOn">;
};

export const CompactMultiSelectField = ({
  name,
  valueKey = "id",
  placeholder = "Selecciona",
  minItems = 1,
  disableDuplicates = true,
  clearable = true,
  filter,
  dependsOn,
  comboboxProps,
}: CompactMultiSelectFieldProps) => {
  const { control } = useFormContext();
  const { fields, append, update, remove } = useFieldArray({
    control,
    name,
    keyName: "fieldId",
  });

  useEffect(() => {
    if (fields.length >= minItems) return;
    const toAdd = minItems - fields.length;
    for (let i = 0; i < toAdd; i += 1) {
      append({ [valueKey]: "" });
    }
  }, [append, fields.length, minItems, valueKey]);

  const values = useMemo(
    () => fields.map((item) => String((item as any)?.[valueKey] ?? "")),
    [fields, valueKey]
  );

  const handleUpdate = (index: number, nextValue: string) => {
    const normalized = String(nextValue ?? "");
    if (disableDuplicates && normalized) {
      const otherValues = values.filter((_, idx) => idx !== index);
      if (otherValues.includes(normalized)) {
        return;
      }
    }

    update(index, { ...(fields[index] as any), [valueKey]: normalized });

    if (index === fields.length - 1 && normalized) {
      append({ [valueKey]: "" });
    }
  };

  const handleRemove = (index: number) => {
    if (fields.length <= minItems) {
      update(index, { ...(fields[index] as any), [valueKey]: "" });
      return;
    }
    remove(index);
  };

  return (
    <div className="space-y-2">
      {fields.map((item, index) => (
        <div key={(item as any).fieldId ?? `${index}`} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <CompactComboboxQuery
              {...comboboxProps}
              value={values[index] ?? ""}
              onChange={(value) => handleUpdate(index, String(value ?? ""))}
              placeholder={placeholder}
              filter={filter}
              dependsOn={dependsOn}
              clearable={clearable}
            />
          </div>
          {fields.length > minItems ? (
            <LineDeleteButton className="shrink-0" onClick={() => handleRemove(index)} />
          ) : null}
        </div>
      ))}
    </div>
  );
};
