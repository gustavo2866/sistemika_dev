/**
 * Custom hook for managing form state and logic
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDataProvider, useNotify, useGetIdentity } from "ra-core";
import { useNavigate } from "react-router-dom";
import type { FormConfig, FieldConfig } from "../types";
import { useValidation } from "./useValidation";
import { getErrorMessage } from "../../utils";

export function useFormLogic<T extends Record<string, any>>(
  config: FormConfig<T>,
  recordId?: string | number
) {
  const [formData, setFormData] = useState<T>({} as T);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const {
    fieldErrors,
    validateField,
    setFieldError,
    clearFieldError,
    clearAllErrors,
  } = useValidation<T>();

  const dataProvider = useDataProvider();
  const notify = useNotify();
  const navigate = useNavigate();
  const { identity } = useGetIdentity();

  const fieldConfigMap = useMemo(() => {
    const map = new Map<string, FieldConfig<T>>();
    config.sections.forEach((section) => {
      section.fields?.forEach((field) => {
        map.set(String(field.name), field as FieldConfig<T>);
      });
    });
    return map;
  }, [config]);

  useEffect(() => {
    clearAllErrors();
    setFormErrors({});
  }, [recordId, clearAllErrors]);

  // Load existing record if recordId is provided
  useEffect(() => {
    if (recordId) {
      setLoading(true);
      dataProvider
        .getOne(config.resource, { id: recordId })
        .then((response: any) => {
          setFormData(response.data as T);
          clearAllErrors();
          setFormErrors({});
        })
        .catch((error: any) => {
          notify(getErrorMessage(error, "Error al cargar el registro"), {
            type: "error",
          });
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setFormData({} as T);
    }
  }, [
    recordId,
    config.resource,
    dataProvider,
    notify,
    clearAllErrors,
  ]);

  const runFieldValidations = useCallback(() => {
    let isValid = true;
    fieldConfigMap.forEach((fieldConfig, fieldName) => {
      const fieldKey = fieldConfig.name as keyof T;
      const value = formData[fieldKey];
      const error = validateField(fieldConfig, value);
      if (error) {
        setFieldError(fieldName, error);
        isValid = false;
      } else {
        clearFieldError(fieldName);
      }
    });
    return isValid;
  }, [
    fieldConfigMap,
    formData,
    validateField,
    setFieldError,
    clearFieldError,
  ]);

  // Update a single field
  const updateField = useCallback(
    (field: keyof T, value: any) => {
      const fieldName = String(field);
      setFormData((prev) => ({ ...prev, [field]: value }));

      const fieldConfig = fieldConfigMap.get(fieldName);
      if (fieldConfig) {
        const error = validateField(fieldConfig, value);
        if (error) {
          setFieldError(fieldName, error);
        } else {
          clearFieldError(fieldName);
        }
      } else {
        clearFieldError(fieldName);
      }

      setFormErrors((prev) => {
        if (prev[fieldName]) {
          const next = { ...prev };
          delete next[fieldName];
          return next;
        }
        return prev;
      });
    },
    [
      fieldConfigMap,
      validateField,
      setFieldError,
      clearFieldError,
    ]
  );

  // Validate form
  const validate = useCallback((): boolean => {
    const fieldsValid = runFieldValidations();
    let validationErrors: Record<string, string> = {};

    if (config.validate) {
      validationErrors = config.validate(formData);
      setFormErrors(validationErrors);
    } else {
      setFormErrors({});
    }

    return fieldsValid && Object.keys(validationErrors).length === 0;
  }, [runFieldValidations, config, formData]);

  // Save form
  const handleSave = useCallback(async () => {
    if (!validate()) {
      notify("Por favor corrija los errores en el formulario", {
        type: "warning",
      });
      return;
    }

    setSaving(true);

    try {
      let dataToSave = formData;
      if (config.onBeforeSave) {
        dataToSave = await config.onBeforeSave(formData);
      }

      const response = recordId
        ? await dataProvider.update(config.resource, {
            id: recordId,
            data: dataToSave,
            previousData: formData,
          })
        : await dataProvider.create(config.resource, {
            data: dataToSave,
          });

      setFormData(response.data as T);

      if (config.onAfterSave) {
        await config.onAfterSave(response.data as T);
      }

      notify(
        recordId
          ? "Registro actualizado correctamente"
          : "Registro creado correctamente",
        { type: "success" }
      );

      if (config.redirectAfterSave) {
        const redirectPath =
          typeof config.redirectAfterSave === "function"
            ? config.redirectAfterSave(response.data.id)
            : config.redirectAfterSave;
        navigate(redirectPath);
      } else {
        navigate(`/${config.resource}`);
      }
    } catch (error) {
      notify(getErrorMessage(error, "Error al guardar"), { type: "error" });
    } finally {
      setSaving(false);
    }
  }, [
    validate,
    formData,
    config,
    recordId,
    dataProvider,
    notify,
    navigate,
  ]);

  // Cancel and navigate back
  const handleCancel = useCallback(() => {
    navigate(`/${config.resource}`);
  }, [navigate, config.resource]);

  const combinedErrors = useMemo(
    () => ({ ...formErrors, ...fieldErrors }),
    [formErrors, fieldErrors]
  );

  return {
    formData,
    setFormData,
    updateField,
    loading,
    saving,
    errors: combinedErrors,
    handleSave,
    handleCancel,
    validate,
    identity,
  };
}
