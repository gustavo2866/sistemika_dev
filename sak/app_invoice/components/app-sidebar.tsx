// Thin re-export: keep the public API at `components/app-sidebar` but
// place the custom implementation inside `components/admin/app-sidebar`.
// Re-export to the implementation placed under the Next.js app admin folder
export { AppSidebar, DashboardMenuItem, ResourceMenuItem } from "@/app/admin/app-sidebar";
