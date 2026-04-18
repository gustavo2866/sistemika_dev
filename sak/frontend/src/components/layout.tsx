import { Suspense, useState, type CSSProperties, type ErrorInfo } from "react";
import { cn } from "@/lib/utils";
import { CoreLayoutProps } from "ra-core";
import { ErrorBoundary } from "react-error-boundary";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { Notification } from "@/components/notification";
import { AppSidebar } from "@/components/app-sidebar";
import { RefreshButton } from "@/components/refresh-button";
import { LocalesMenuButton } from "@/components/locales-menu-button";
import { Error } from "@/components/error";
import { Loading } from "@/components/loading";

export const Layout = (props: CoreLayoutProps) => {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | undefined>(undefined);
  const handleError = (_: Error, info: ErrorInfo) => {
    setErrorInfo(info);
  };
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "clamp(12.5rem, 10.5rem + 3vw, 16rem)",
          "--sidebar-width-icon": "clamp(2.75rem, 2.5rem + 0.35vw, 3rem)",
        } as CSSProperties
      }
    >
      <AppSidebar />
      <main
        id="admin-main"
        className={cn(
          "ml-auto w-full min-w-0 max-w-full",
          "peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)]",
          "peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))]",
          "sm:transition-[width] sm:duration-200 sm:ease-linear",
          "relative flex h-svh flex-col overflow-hidden",
          "group-data-[scroll-locked=1]/body:h-full",
          "has-[main.fixed-main]:group-data-[scroll-locked=1]/body:h-svh",
        )}
        >
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 md:h-12">
          <SidebarTrigger className="scale-125 sm:scale-100" />
          <div className="flex-1 flex items-center" id="breadcrumb" />
          <LocalesMenuButton />
          <ThemeModeToggle />
          <RefreshButton />
          <UserMenu />
        </header>
        <ErrorBoundary
          onError={handleError}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <Error
              error={error}
              errorInfo={errorInfo}
              resetErrorBoundary={resetErrorBoundary}
            />
          )}
        >
          <Suspense fallback={<Loading />}>
            <div
              id="admin-content"
              className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4"
            >
              {props.children}
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Notification />
    </SidebarProvider>
  );
};
