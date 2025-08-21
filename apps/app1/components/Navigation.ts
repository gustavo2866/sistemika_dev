import type { SidebarData } from "@workspace/ui";

export const sidebarData: SidebarData = {
  versions: ["1.0.1"],
  defaultVersion: "1.0.1",
  navMain: [
    {
      title: "Getting Started",
      categoryId: "docs",
      items: [
        { title: "Installation", href: "/installation" },
        { title: "Project Structure", href: "/structure" },
      ],
    },
    {
      title: "Endpoints",
      categoryId: "api",
      items: [
        { title: "Auth", href: "/api/auth" },
        { title: "Users", href: "/api/users" },
      ],
    },
    {
      title: "Tutorials",
      categoryId: "guides",
      items: [
        { title: "First steps", href: "/guides/first-steps" },
        { title: "Advanced", href: "/guides/advanced" },
      ],
    },
  ],
};
