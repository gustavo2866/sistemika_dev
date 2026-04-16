"use client";

import { useState } from "react";
import { ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ArchivoViewerModalProps = {
  url: string;
  nombre: string;
  /** Button label. Defaults to "Ver". */
  label?: string;
};

const isPdfUrl = (url: string) =>
  url.split("?")[0].toLowerCase().endsWith(".pdf");

const isImageUrl = (url: string) => {
  const base = url.split("?")[0].toLowerCase();
  return [".jpg", ".jpeg", ".png", ".gif", ".webp"].some((ext) =>
    base.endsWith(ext)
  );
};

export const ArchivoViewerModal = ({
  url,
  nombre,
  label = "Ver",
}: ArchivoViewerModalProps) => {
  const [open, setOpen] = useState(false);
  const canPreview = isPdfUrl(url) || isImageUrl(url);

  if (!canPreview) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline"
      >
        {label}
      </a>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-1.5 text-xs text-blue-600 hover:text-blue-700"
        onClick={() => setOpen(true)}
      >
        <Eye className="h-3 w-3" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex h-[90vh] max-w-4xl flex-col gap-2 p-4"
          aria-describedby={undefined}
        >
          <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 pr-8">
            <DialogTitle className="truncate text-sm font-medium">
              {nombre}
            </DialogTitle>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir en nueva pestaña
            </a>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/60 bg-muted/30">
            {isPdfUrl(url) ? (
              <iframe
                src={url}
                title={nombre}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full items-center justify-center overflow-auto p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={nombre}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
