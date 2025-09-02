import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  CreateBase,
  type CreateBaseProps,
  Translate,
  useCreateContext,
  useCreatePath,
  useGetResourceLabel,
  useHasDashboard,
  useResourceContext,
} from "ra-core";
import { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export type CreateProps = CreateViewProps & CreateBaseProps;

export const Create = ({
  title,
  children,
  actions,
  className,
  ...rest
}: CreateProps) => (
  <CreateBase {...rest}>
    <CreateView title={title} actions={actions} className={className}>
      {children}
    </CreateView>
  </CreateBase>
);

export type CreateViewProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: ReactNode | string | false;
};

export const CreateView = ({
  actions,
  title,
  children,
  className,
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
  const hasDashboard = useHasDashboard();

  return (
    <>
      <Breadcrumb>
        {hasDashboard && (
          <BreadcrumbItem>
            <Link to="/">
              <Translate i18nKey="ra.page.dashboard">Home</Translate>
            </Link>
          </BreadcrumbItem>
        )}
        <BreadcrumbItem>
          <Link to={listLink}>{listLabel}</Link>
        </BreadcrumbItem>
        <BreadcrumbPage>
          <Translate i18nKey="ra.action.create">Create</Translate>
        </BreadcrumbPage>
      </Breadcrumb>
      <div
        className={cn(
          "flex justify-between items-start flex-wrap gap-4 my-6 pb-4 border-b border-border",
          className,
        )}
      >
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">
            {title !== undefined ? title : context.defaultTitle}
          </h2>
          <p className="text-muted-foreground">
            <Translate i18nKey="ra.message.create_description">
              Crear un nuevo registro
            </Translate>
          </p>
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="pb-8">{children}</div>
    </>
  );
};
