"use client";

export type OportunidadModalBackground = {
  html: string;
  scrollY: number;
};

export const captureOportunidadModalBackground =
  (): OportunidadModalBackground | undefined => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const container = document.getElementById("admin-content");
    if (!(container instanceof HTMLElement)) {
      return undefined;
    }

    return {
      html: container.innerHTML,
      scrollY: window.scrollY,
    };
  };

export const renderOportunidadModalBackground = (
  background?: OportunidadModalBackground,
) => {
  if (!background?.html) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-100 mix-blend-normal [filter:none]"
      aria-hidden="true"
    >
      <div
        className="opacity-100 mix-blend-normal [filter:none]"
        style={{ transform: `translateY(-${background.scrollY ?? 0}px)` }}
        dangerouslySetInnerHTML={{ __html: background.html }}
      />
    </div>
  );
};
