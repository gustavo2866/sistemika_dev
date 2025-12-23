"use client";

import { useCallback, useState } from "react";

export interface UseKanbanMoveControllerOptions<TItem, K extends string> {
  onMove: (item: TItem, bucket: K) => boolean | void | Promise<boolean | void>;
  canMove?: (item: TItem, bucket: K) => boolean | Promise<boolean>;
  onMoveStart?: (item: TItem, bucket: K) => void;
  onMoveSuccess?: (item: TItem, bucket: K) => void;
  onMoveError?: (error: unknown, item: TItem, bucket: K) => void;
  onAfterMove?: (item: TItem, bucket: K) => void | Promise<void>;
  getItemId?: (item: TItem) => string | number | null | undefined;
}

export interface UseKanbanMoveControllerResult<TItem, K extends string> {
  handleItemMove: (item: TItem, bucket: K) => Promise<void>;
  isMoving: boolean;
  movingItemId: string | number | null;
}

export const useKanbanMoveController = <TItem, K extends string>({
  onMove,
  canMove,
  onMoveStart,
  onMoveSuccess,
  onMoveError,
  onAfterMove,
  getItemId = (item: any) => item?.id ?? null,
}: UseKanbanMoveControllerOptions<TItem, K>): UseKanbanMoveControllerResult<TItem, K> => {
  const [isMoving, setIsMoving] = useState(false);
  const [movingItemId, setMovingItemId] = useState<string | number | null>(null);

  const handleItemMove = useCallback(
    async (item: TItem, bucket: K) => {
      const allowed = canMove ? await Promise.resolve(canMove(item, bucket)) : true;
      if (!allowed) return;

      onMoveStart?.(item, bucket);
      const itemId = getItemId(item);
      if (itemId !== null && itemId !== undefined) {
        setMovingItemId(itemId);
      }
      setIsMoving(true);

      try {
        const result = await Promise.resolve(onMove(item, bucket));
        if (result === false) {
          return;
        }
        onMoveSuccess?.(item, bucket);
        if (onAfterMove) {
          await Promise.resolve(onAfterMove(item, bucket));
        }
      } catch (error) {
        onMoveError?.(error, item, bucket);
      } finally {
        setIsMoving(false);
        setMovingItemId(null);
      }
    },
    [canMove, getItemId, onAfterMove, onMove, onMoveError, onMoveStart, onMoveSuccess]
  );

  return { handleItemMove, isMoving, movingItemId };
};
