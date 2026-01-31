import type { TextInputProps } from "@/components/text-input";
import { CompactTextInput } from "./compact-text-input";

type CompactDateInputProps = Omit<TextInputProps, "type"> & {
  required?: boolean;
};

export const CompactDateInput = (props: CompactDateInputProps) => {
  return <CompactTextInput {...props} type="date" />;
};
