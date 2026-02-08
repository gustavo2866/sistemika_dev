import type { Key, ReactElement, ReactNode } from "react";

import type { TextInputProps } from "@/components/text-input";
import type { SelectInputProps } from "@/components/select-input";
import type { ReferenceInputProps } from "@/components/reference-input";
import { TextInput as BaseTextInput } from "@/components/text-input";
import { SelectInput as BaseSelectInput } from "@/components/select-input";
import { ReferenceInput as BaseReferenceInput } from "@/components/reference-input";
import { cn } from "@/lib/utils";

export const CompactTextInput = ({ className, ...props }: TextInputProps) => {
  return <BaseTextInput {...props} className={cn("compact-filter", className)} />;
};

export const CompactSelectInput = ({ className, ...props }: SelectInputProps) => {
  return <BaseSelectInput {...props} className={cn("compact-filter", className)} />;
};

interface CompactReferenceInputProps extends ReferenceInputProps {
  className?: string;
}

export const CompactReferenceInput = ({
  className,
  children,
  ...props
}: CompactReferenceInputProps) => {
  return (
    <div className={cn("compact-filter", className)}>
      <BaseReferenceInput {...props}>{children}</BaseReferenceInput>
    </div>
  );
};

export type FilterBuilderItem =
  | {
      type: "text";
      key?: Key;
      props: TextInputProps;
    }
  | {
      type: "select";
      key?: Key;
      props: SelectInputProps;
    }
  | {
      type: "reference";
      key?: Key;
      referenceProps: ReferenceInputProps;
      selectProps?: SelectInputProps;
      children?: ReactNode;
    }
  | {
      type: "custom";
      element: ReactElement;
    };

type FilterBuilderOptions = {
  keyPrefix?: string;
};

const buildKey = (fallback: Key, prefix?: string) =>
  prefix ? `${prefix}-${String(fallback)}` : String(fallback);

export const buildListFilters = (
  items: FilterBuilderItem[],
  options: FilterBuilderOptions = {},
): ReactElement[] => {
  const { keyPrefix } = options;

  return items.map((item, index) => {
    if (item.type === "custom") {
      return item.element;
    }

    if (item.type === "text") {
      const key =
        item.key ?? String(item.props.source) ?? String(item.props.label) ?? `text-${index}`;
      return <CompactTextInput key={buildKey(key, keyPrefix)} {...item.props} />;
    }

    if (item.type === "select") {
      const key =
        item.key ?? String(item.props.source) ?? String(item.props.label) ?? `select-${index}`;
      return <CompactSelectInput key={buildKey(key, keyPrefix)} {...item.props} />;
    }

    const referenceKey =
      item.key ??
      String(item.referenceProps.source) ??
      String(item.referenceProps.label) ??
      `reference-${index}`;
    const children =
      item.children ?? (item.selectProps ? <CompactSelectInput {...item.selectProps} /> : null);

    return (
      <CompactReferenceInput key={buildKey(referenceKey, keyPrefix)} {...item.referenceProps}>
        {children}
      </CompactReferenceInput>
    );
  });
};

