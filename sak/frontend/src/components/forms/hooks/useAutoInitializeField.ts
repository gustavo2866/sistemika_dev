import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useGetIdentity } from "ra-core";

export const useAutoInitializeField = (
  fieldName: string,
  identityKey: string = "id",
  condition: boolean = true
) => {
  const { setValue, watch } = useFormContext();
  const { identity } = useGetIdentity();
  const fieldValue = watch(fieldName);

  useEffect(() => {
    if (
      condition &&
      identity?.[identityKey] != null &&
      (fieldValue == null || fieldValue === "")
    ) {
      setValue(fieldName, identity[identityKey], { shouldDirty: false });
    }
  }, [condition, identity, identityKey, fieldName, fieldValue, setValue]);
};
