"use client";

import { useCallback, type MouseEvent } from "react";
import {
  type Identifier,
  useCreatePath,
  useRecordContext,
  useResourceContext,
} from "ra-core";
import { useNavigate } from "react-router-dom";

import { useConfirmDelete } from "@/components/forms/form_order";
import type { ErpCuenta, ErpRubroFormValues } from "./model";

export type ErpRubroRecord = ErpRubroFormValues & {
  id?: Identifier;
  cuentas?: ErpCuenta[];
  created_at?: string | null;
  updated_at?: string | null;
};

export const useAccionesCabeceraRubro = () => {
  const record = useRecordContext<ErpRubroRecord>();
  const resource = useResourceContext();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const { confirmDelete, setConfirmDelete, deleting, handleDelete } =
    useConfirmDelete({ record, resource });

  const canPreview = Boolean(record?.id && resource);
  const canDelete = canPreview;

  const onPreview = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!record?.id || !resource) return;
      navigate(createPath({ resource, type: "show", id: record.id }));
    },
    [createPath, navigate, record?.id, resource],
  );

  const onRequestDelete = useCallback(() => {
    setConfirmDelete(true);
  }, [setConfirmDelete]);

  return {
    canPreview,
    canDelete,
    onPreview,
    onRequestDelete,
    confirmDelete,
    setConfirmDelete,
    deleting,
    handleDelete,
  };
};

