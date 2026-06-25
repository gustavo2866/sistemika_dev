"use client";

import { cn } from "@/lib/utils";
import {
  SimpleFormIterator,
  type SimpleFormIteratorProps,
} from "@/components/simple-form-iterator";

export const DETAIL_ITERATOR_CLASSNAME =
  "gap-0 [&_ul]:gap-2 sm:[&_ul]:gap-0 [&_li]:pb-0 [&_li]:gap-0 " +
  "[&_li]:border-b-0 [&_li]:border-transparent [&_li]:relative " +
  "[&_li]:flex-col sm:[&_li]:flex-row [&_li]:items-stretch " +
  "sm:[&_li]:items-center [&_.simple-form-iterator-item-actions]:hidden";

export const DetailIterator = ({
  className,
  ...rest
}: SimpleFormIteratorProps) => {
  return (
    <SimpleFormIterator
      inline
      disableClear
      disableReordering
      disableRemove
      className={cn(DETAIL_ITERATOR_CLASSNAME, className)}
      {...rest}
    />
  );
};
