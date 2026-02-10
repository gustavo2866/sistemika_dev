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
  "sm:[&_li]:items-center [&_.simple-form-iterator-item-actions]:!pt-0 " +
  "[&_.simple-form-iterator-item-actions]:items-center " +
  "[&_.simple-form-iterator-item-actions]:self-center " +
  "[&_.simple-form-iterator-item-actions]:gap-0 " +
  "[&_.simple-form-iterator-item-actions]:mt-0 " +
  "[&_.simple-form-iterator-item-actions]:h-6 " +
  "[&_.simple-form-iterator-item-actions]:-translate-y-[1px] " +
  "[&_.simple-form-iterator-item-actions]:-ml-1 " +
  "[&_.simple-form-iterator-item-actions>*]:-ml-3 " +
  "[&_.simple-form-iterator-item-actions]:absolute " +
  "[&_.simple-form-iterator-item-actions]:top-2 " +
  "[&_.simple-form-iterator-item-actions]:right-2 " +
  "sm:[&_.simple-form-iterator-item-actions]:static";

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
