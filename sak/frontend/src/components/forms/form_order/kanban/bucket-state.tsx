"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const KanbanBucketLoadingState = ({
  message = "Cargando...",
  className,
}: {
  message?: string;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200/80 bg-white/60 px-2 py-3 text-center text-[9px] text-slate-500",
      className,
    )}
  >
    <LoaderCircle className="h-3 w-3 animate-spin" />
    <span>{message}</span>
  </div>
);

export const KanbanBucketErrorState = ({
  message,
  className,
}: {
  message: string;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200/80 bg-rose-50/80 px-2 py-3 text-center text-[9px] text-rose-700",
      className,
    )}
  >
    <AlertCircle className="h-3 w-3 shrink-0" />
    <span>{message}</span>
  </div>
);

export const KanbanBucketFooter = ({
  loadedCount,
  total,
  hasMore,
  isLoadingMore,
  error,
  onLoadMore,
  className,
}: {
  loadedCount: number;
  total: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  className?: string;
}) => {
  const showProgress = total > 0 && (hasMore || loadedCount !== total);
  const showFooter = showProgress || Boolean(error) || Boolean(hasMore);

  if (!showFooter) return null;

  return (
    <div
      className={cn(
        "flex min-h-8 items-center justify-between gap-2 border-t border-slate-200/70 px-1 pt-1",
        className,
      )}
    >
      <div className="min-w-0 text-[8px] text-slate-500">
        {error ? (
          <span className="inline-flex items-center gap-1 text-rose-600">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">{error}</span>
          </span>
        ) : showProgress ? (
          <span>
            {loadedCount} de {total}
          </span>
        ) : null}
      </div>
      {hasMore && onLoadMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 rounded-full px-2 text-[8px]"
          onClick={onLoadMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? (
            <>
              <LoaderCircle className="h-3 w-3 animate-spin" />
              Cargando
            </>
          ) : (
            "Ver mas"
          )}
        </Button>
      ) : null}
    </div>
  );
};
