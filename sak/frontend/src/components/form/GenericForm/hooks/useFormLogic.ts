/**
 * Custom hook for managing form state and logic
 */

import { useState, useEffect, useCallback } from "react";
import { useDataProvider, useNotify, useGetIdentity } from "ra-core";
import { useNavigate } from "react-router-dom";
import type { FormConfig } from "../types";
import { getErrorMessage } from "../../utils";

export function useFormLogic<T extends Record<string, any>>(
  config: FormConfig<T>,
  recordId?: string | number
) {
  const [formData, setFormData] = useState<T>({} as T);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const navigate = useNavigate();
  const { identity } = useGetIdentity();

  // Load existing record if recordId is provided
  useEffect(() => {
    if (recordId) {
      setLoading(true);
      dataProvider
        .getOne(config.resource, { id: recordId })
        .then((response: any) => {
          setFormData(response.data as T);
        })
        .catch((error: any) => {
          notify(getErrorMessage(error, "Error al cargar el registro"), {
            type: "error",
          });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [recordId, config.resource, dataProvider, notify]);

  // Update a single field
  const updateField = useCallback((field: keyof T, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field if any
    if (errors[field as string]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
    }
  }, [errors]);

  // Validate form
  const validate = useCallback((): boolean => {
    if (config.validate) {
      const validationErrors = config.validate(formData);
      setErrors(validationErrors);
      return Object.keys(validationErrors).length === 0;
    }
    return true;
  }, [config, formData]);

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
      // Run onBeforeSave hook if defined
      let dataToSave = formData;
      if (config.onBeforeSave) {
        dataToSave = await config.onBeforeSave(formData);
      }

      // Save to backend
      const response = recordId
        ? await dataProvider.update(config.resource, {
            id: recordId,
            data: dataToSave,
            previousData: formData,
          })
        : await dataProvider.create(config.resource, {
            data: dataToSave,
          });

      // Run onAfterSave hook if defined
      if (config.onAfterSave) {
        await config.onAfterSave(response.data as T);
      }

      notify(
        recordId
          ? "Registro actualizado correctamente"
          : "Registro creado correctamente",
        { type: "success" }
      );

      // Navigate after save
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

  return {
    formData,
    setFormData,
    updateField,
    loading,
    saving,
    errors,
    setErrors,
    handleSave,
    handleCancel,
    validate,
    identity,
  };
}
