"use client";

import { FormOrderEditButton } from "@/components/forms/form_order";
import { Show } from "@/components/show";

import {
  PoOrderDetailContent,
  PoOrderStatusTitle,
} from "./detail-content";

export const PoOrderShow = () => (
  <Show
    className="w-full max-w-3xl"
    title={<PoOrderStatusTitle fallback="Ordenes" />}
    actions={<FormOrderEditButton />}
  >
    <div className="print-root w-full max-w-3xl">
      <PoOrderDetailContent showPrintButton showCancelButton />
    </div>
  </Show>
);
