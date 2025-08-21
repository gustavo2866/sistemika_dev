export type NavLeaf = { title: string; href: string; isActive?: boolean }
export type NavGroup = { title: string; items: NavLeaf[]; categoryId?: string }

export type Category = {
  id: string
  label: string
}

export type SidebarData = {
  versions: string[]
  defaultVersion: string
  navMain: NavGroup[]
  categories?: Category[]
  defaultCategoryId?: string
}

export type Crumb =
  | { type: "link"; label: string; href: string }
  | { type: "page"; label: string }
