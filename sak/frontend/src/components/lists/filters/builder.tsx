import type { Key, ReactElement, ReactNode } from "react";
import type { TextInputProps } from "@/components/text-input";
import type { SelectInputProps } from "@/components/select-input";
import type { ReferenceInputProps } from "@/components/reference-input";
import { CompactTextInput } from "./compact-text-input";
import { CompactSelectInput } from "./compact-select-input";
import { CompactReferenceInput } from "./compact-reference-input";

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

// Builds a filter array from declarative config items.
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
        item.key ?? item.props.source ?? item.props.label ?? `text-${index}`;
      return (
        <CompactTextInput
          key={buildKey(key, keyPrefix)}
          {...item.props}
        />
      );
    }

    if (item.type === "select") {
      const key =
        item.key ?? item.props.source ?? item.props.label ?? `select-${index}`;
      return (
        <CompactSelectInput
          key={buildKey(key, keyPrefix)}
          {...item.props}
        />
      );
    }

    const referenceKey =
      item.key ??
      item.referenceProps.source ??
      item.referenceProps.label ??
      `reference-${index}`;
    const children =
      item.children ?? (item.selectProps ? <CompactSelectInput {...item.selectProps} /> : null);

    return (
      <CompactReferenceInput
        key={buildKey(referenceKey, keyPrefix)}
        {...item.referenceProps}
      >
        {children}
      </CompactReferenceInput>
    );
  });
};
