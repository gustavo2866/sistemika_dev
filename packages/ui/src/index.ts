// Primitives / components
export * from "./components/button";
export * from "./components/checkbox";
export * from "./components/dialog";
export * from "./components/input";
export * from "./components/select";
export * from "./components/textarea";
export { ThemeProvider } from "./components/theme-provider";
export { ThemeToggle } from "./components/theme-toggle";
export * from "./components/sidebar";

// Tipos
export * from "./types/navigation";

// Bloques / layout (agnósticos)
export { DefaultLink } from "./layout/link-slot";
export type { LinkComponent } from "./layout/link-slot";

export { BreadcrumbCore } from "./layout/breadcrumb-core";
export { AppSidebarCore } from "./layout/app-sidebar-core";
export { VersionSwitcher } from "./layout/version-switcher";
export { CategorySwitch } from "./layout/category-switch";
export { PageHeader } from "./layout/page-header";
export { SearchForm } from "./layout/search-form";
export { SidebarShell } from "./layout/shell";
export { ContentGrid } from "./layout/content-grid";
export { Footer } from "./layout/footer";
