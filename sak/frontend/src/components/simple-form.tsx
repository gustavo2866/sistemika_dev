import * as React from "react";
import { Children, ReactNode } from "react";
import { Form, type FormProps } from "ra-core";
import { cn } from "@/lib/utils";
import { CancelButton } from "@/components/cancel-button";
import { SaveButton } from "@/components/form";
import { FormHeaderDensityProvider, type FormHeaderDensity } from "@/components/forms/form-header-density-context";

export const SimpleForm = ({
  children,
  className,
  toolbar = defaultFormToolbar,
  sectionHeaderDensity = "default",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  toolbar?: ReactNode;
  sectionHeaderDensity?: FormHeaderDensity;
} & FormProps) => (
  <Form
    className={cn("flex w-full max-w-lg flex-col gap-3 sm:gap-4", className)}
    {...rest}
  >
    <FormHeaderDensityProvider value={sectionHeaderDensity}>
      {children}
      {toolbar}
    </FormHeaderDensityProvider>
  </Form>
);

export const FormToolbar = ({
  children,
  className,
  ...rest
}: FormToolbarProps) => (
  <div
    {...rest}
    className={cn(
      "sticky bottom-0 bg-linear-to-b from-transparent to-background to-10% pb-3 pt-3 md:block md:pb-0 md:pt-2",
      className,
    )}
    role="toolbar"
  >
    {Children.count(children) === 0 ? (
      <div className="flex flex-row gap-2 justify-end">
        <CancelButton />
        <SaveButton />
      </div>
    ) : (
      children
    )}
  </div>
);

export interface FormToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
}

const defaultFormToolbar = <FormToolbar />;
