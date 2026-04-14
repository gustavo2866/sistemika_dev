import { AppBreadcrumb } from "@/components/app-breadcrumb";
import {
  CreateBase,
  type CreateBaseProps,
  Translate,
  useCreateContext,
  useCreatePath,
  useGetResourceLabel,
  useResourceContext,
} from "ra-core";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CreateProps = CreateViewProps & CreateBaseProps;

export const Create = ({
  title,
  children,
  actions,
  className,
  showBreadcrumb,
  showHeader,
  ...rest
}: CreateProps) => (
  <CreateBase {...rest}>
    <CreateView
      title={title}
      actions={actions}
      className={className}
      showBreadcrumb={showBreadcrumb}
      showHeader={showHeader}
    >
      {children}
    </CreateView>
  </CreateBase>
);

export type CreateViewProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: ReactNode | string | false;
  showBreadcrumb?: boolean;
  showHeader?: boolean;
};

export const CreateView = ({
  actions,
  title,
  children,
  className,
  showBreadcrumb = true,
  showHeader = true,
}: CreateViewProps) => {
  const context = useCreateContext();

  const resource = useResourceContext();
  if (!resource) {
    throw new Error(
      "The CreateView component must be used within a ResourceContextProvider",
    );
  }
  const getResourceLabel = useGetResourceLabel();
  const listLabel = getResourceLabel(resource, 2);
  const createPath = useCreatePath();
  const listLink = createPath({
    resource,
    type: "list",
  });
  return (
    <>
      {showBreadcrumb ? (
        <AppBreadcrumb
          items={[
            { label: listLabel, to: listLink },
            {
              label: <Translate i18nKey="ra.action.create">Create</Translate>,
              current: true,
            },
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
          {actions}
        </div>
      ) : null}
      <div className="my-2 w-full max-w-3xl">{children}</div>
    </>
  );
};
