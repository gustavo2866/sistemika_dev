import {
  EditBase,
  EditBaseProps,
  useCreatePath,
  useEditContext,
  useGetRecordRepresentation,
  useGetResourceLabel,
  useResourceContext,
  useResourceDefinition,
} from "ra-core";
import { ReactNode } from "react";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { cn } from "@/lib/utils";
import { ShowButton } from "@/components/show-button";
import { DeleteButton } from "./delete-button";

export interface EditProps extends EditViewProps, EditBaseProps {}

export const Edit = ({
  title,
  children,
  actions,
  className,
  showBreadcrumb,
  showHeader,
  ...rest
}: EditProps) => {
  const { redirect: redirectProp, ...baseProps } = rest;
  const redirect = redirectProp ?? "list";

  return (
    <EditBase {...baseProps} redirect={redirect}>
      <EditView
        title={title}
        actions={actions}
        className={className}
        showBreadcrumb={showBreadcrumb}
        showHeader={showHeader}
      >
        {children}
      </EditView>
    </EditBase>
  );
};

export interface EditViewProps {
  title?: ReactNode | string | false;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  showBreadcrumb?: boolean;
  showHeader?: boolean;
}

export const EditView = ({
  title,
  actions,
  className,
  children,
  showBreadcrumb = true,
  showHeader = true,
}: EditViewProps) => {
  const context = useEditContext();

  const resource = useResourceContext();
  if (!resource) {
    throw new Error(
      "The EditView component must be used within a ResourceContextProvider",
    );
  }
  const getResourceLabel = useGetResourceLabel();
  const listLabel = getResourceLabel(resource, 2);
  const createPath = useCreatePath();
  const defaultListLink = createPath({
    resource,
    type: "list",
  });
  const listLink = defaultListLink;

  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const recordRepresentation = getRecordRepresentation(context.record);

  const { hasShow } = useResourceDefinition({ resource });

  if (context.isLoading || !context.record) {
    return null;
  }

  return (
    <>
      {showBreadcrumb ? (
        <AppBreadcrumb
          items={[
            { label: listLabel, to: listLink },
            { label: recordRepresentation, current: true },
          ]}
        />
      ) : null}
      {showHeader ? (
        <div
          className={cn(
            "flex justify-between items-start flex-wrap gap-2 my-2 w-full max-w-3xl",
            className,
          )}
        >
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {title !== undefined ? title : context.defaultTitle}
          </h2>
          {actions ?? (
            <div className="flex justify-end items-center gap-2">
              {hasShow ? <ShowButton /> : null}
              <DeleteButton />
            </div>
          )}
        </div>
      ) : null}
      <div className="my-2 w-full max-w-3xl">{children}</div>
    </>
  );
};
