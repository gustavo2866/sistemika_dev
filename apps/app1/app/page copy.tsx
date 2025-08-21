
import { ThemeToggle } from "@workspace/ui/components/theme-toggle";
import type { SidebarData, Crumb } from "@workspace/ui/types/navigation"
import {  SidebarShell, 
          PageHeader, 
          AppSidebarCore, 
          BreadcrumbCore, 
          Footer,
          SidebarTrigger
        } from "@workspace/ui"
import { NextLinkAdapter } from "../components/NextLinkAdapter"
import SearchFormNext from "../components/SearchFormNext"

const data: SidebarData = {
  versions: ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"],
  defaultVersion: "1.0.1",
  defaultCategoryId: "docs",
  navMain: [
    { title: "Getting Started", categoryId: "docs", items: [
      { title: "Installation", href: "/installation" },
      { title: "Project Structure", href: "/structure" },
    ]},
    { title: "Endpoints", categoryId: "api", items: [
      { title: "Auth", href: "/api/auth" },
      { title: "Users", href: "/api/users" },
    ]},
    { title: "Tutorials", categoryId: "guides", items: [
      { title: "First steps", href: "/guides/first-steps" },
      { title: "Advanced", href: "/guides/advanced" },
    ]},
  ],
}

const crumbs: Crumb[] = [
  { type: "link", label: "Docs", href: "/installation" },
  { type: "page", label: "Installation" },
]

export default function Page() {
  return (
    <SidebarShell
      sidebar={<AppSidebarCore data={data} Link={NextLinkAdapter} />}
      header={
        <PageHeader
          leading={<SidebarTrigger className="-ml-1" />}  
          //leading={<SidebarTrigger />}  // si exportás este primitive, podés ponerlo acá
          trailing={
            <div className="flex items-center gap-2">
              <SearchFormNext />
              { <ThemeToggle /> }
            </div>
          }
        >
          <BreadcrumbCore items={crumbs} Link={NextLinkAdapter} />
        </PageHeader>
      }
      footer={<Footer left="© Your Company" right={<span>v1.0</span>} />}
    >
      <div className="rounded-lg border bg-card p-6 text-card-foreground">
        Contenido principal
      </div>
    </SidebarShell>
  )
}
