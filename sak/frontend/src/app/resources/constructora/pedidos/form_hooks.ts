"use client";

import { useCallback, type MouseEvent } from "react";
import {
  useCreatePath,
  useRecordContext,
  useResourceContext,
} from "ra-core";
import { useNavigate } from "react-router-dom";

import { useConfirmDelete } from "@/components/forms/form_order";
import {
  isPedidoReadOnly,
  type ConstructoraPedidoRecord,
} from "./model";

export const usePedidoReadOnly = () => {
  const record = useRecordContext<ConstructoraPedidoRecord>();
  return isPedidoReadOnly(record?.estado);
};

export const useAccionesCabeceraPedido = () => {
  const record = useRecordContext<ConstructoraPedidoRecord>();
  const resource = useResourceContext();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const { confirmDelete, setConfirmDelete, deleting, handleDelete } =
    useConfirmDelete({ record, resource });

  const isLocked = isPedidoReadOnly(record?.estado);
  const canPreview = Boolean(record?.id && resource);
  const canDelete = canPreview && !isLocked;

  const onPreview = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!record?.id || !resource) return;
      navigate(createPath({ resource, type: "show", id: record.id }));
    },
    [record?.id, resource, navigate, createPath],
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
    isLocked,
  };
};
