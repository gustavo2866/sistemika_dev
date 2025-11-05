/**
 * Custom hook for field-level validation
 */

import { useState, useCallback } from "react";
import type { FieldConfig, ValidationRule } from "../types";
import { validateRange, validatePattern } from "../../utils";

export function useValidation<T = any>() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateField = useCallback(
    (fieldConfig: FieldConfig<T>, value: any): string | null => {
      const rules: ValidationRule[] = [...(fieldConfig.validations ?? [])];

      if (
        fieldConfig.required &&
        !rules.some((rule) => rule.type === "required")
      ) {
        rules.unshift({
          type: "required",
          message: `${fieldConfig.label} es requerido`,
        });
      }

      if (rules.length === 0) return null;

      for (const rule of rules) {
        let error: string | null = null;

        switch (rule.type) {
          case "required":
            if (
              value === null ||
              value === undefined ||
              value === "" ||
              (Array.isArray(value) && value.length === 0)
            ) {
              error = rule.message || `${fieldConfig.label} es requerido`;
            }
            break;

          case "min":
            if (typeof value === "number" && rule.value !== undefined) {
              error = validateRange(
                value,
                rule.value as number,
                null,
                fieldConfig.label
              );
            }
            break;

          case "max":
            if (typeof value === "number" && rule.value !== undefined) {
              error = validateRange(
                value,
                null,
                rule.value as number,
                fieldConfig.label
              );
            }
            break;

          case "pattern":
            if (typeof value === "string" && rule.value instanceof RegExp) {
              error = validatePattern(
                value,
                rule.value,
                fieldConfig.label,
                rule.message
              );
            }
            break;

          case "custom":
            if (rule.validator) {
              error = rule.validator(value);
            }
            break;
        }

        if (error) return error;
      }

      return null;
    },
    []
  );

  const setFieldError = useCallback((fieldName: string, error: string | null) => {
    setFieldErrors((prev) => {
      if (error === null) {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      }
      return { ...prev, [fieldName]: error };
    });
  }, []);

  const clearFieldError = useCallback((fieldName: string) => {
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  return {
    fieldErrors,
    validateField,
    setFieldError,
    clearFieldError,
    clearAllErrors,
  };
}
