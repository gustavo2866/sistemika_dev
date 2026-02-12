"use client";

import { useCallback, useState } from "react";
import {
  type Identifier,
  useCreatePath,
  useDataProvider,
  useNotify,
} from "ra-core";
import { useNavigate } from "react-router-dom";

export type UseConfirmDeleteOptions<TRecord extends { id?: Identifier }> = {
  record?: TRecord | null;
  resource?: string | null;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
};

export type UseConfirmDeleteResult = {
  confirmDelete: boolean;
  setConfirmDelete: (value: boolean) => void;
  deleting: boolean;
  handleDelete: () => Promise<void>;
};

export const useConfirmDelete = <TRecord extends { id?: Identifier }>(
  options: UseConfirmDeleteOptions<TRecord>,
): UseConfirmDeleteResult => {
  const {
    record,
    resource,
    successMessage = "Registro eliminado",
    errorMessage = "No se pudo eliminar",
    onSuccess,
  } = options;
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!record || !record.id || !resource || deleting) return;
    setDeleting(true);
    try {
      const previousData = record as TRecord & { id: Identifier };
      await dataProvider.delete(resource, {
        id: record.id,
        previousData,
      });
      notify(successMessage, { type: "info" });
      if (onSuccess) {
        onSuccess();
      } else {
        navigate(createPath({ resource, type: "list" }));
      }
    } catch (error) {
      console.error(error);
      notify(errorMessage, { type: "warning" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [
    record,
    resource,
    deleting,
    dataProvider,
    notify,
    successMessage,
    errorMessage,
    onSuccess,
    navigate,
    createPath,
  ]);

  return { confirmDelete, setConfirmDelete, deleting, handleDelete };
};
