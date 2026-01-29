import { ReactNode } from "react";
import { Link } from "react-router";
import { Translate, useHasDashboard } from "ra-core";
import { Breadcrumb, BreadcrumbItem, BreadcrumbPage } from "@/components/breadcrumb";

export type AppBreadcrumbItem = {
  label: ReactNode;
  to?: string;
  current?: boolean;
};

export const AppBreadcrumb = ({
  items,
  showHome = true,
}: {
  items: AppBreadcrumbItem[];
  showHome?: boolean;
}) => {
  const hasDashboard = useHasDashboard();
  const breadcrumbItems: AppBreadcrumbItem[] = [];

  if (showHome && hasDashboard) {
    breadcrumbItems.push({
      label: <Translate i18nKey="ra.page.home">Home</Translate>,
      to: "/",
    });
  }

  breadcrumbItems.push(...items);

  return (
    <Breadcrumb>
      {breadcrumbItems.map((item, index) => {
        const isCurrent =
          item.current ?? index === breadcrumbItems.length - 1;
        if (item.to && !isCurrent) {
          return (
            <BreadcrumbItem key={`${index}-link`}>
              <Link to={item.to}>{item.label}</Link>
            </BreadcrumbItem>
          );
        }
        return (
          <BreadcrumbPage key={`${index}-page`}>
            {item.label}
          </BreadcrumbPage>
        );
      })}
    </Breadcrumb>
  );
};
