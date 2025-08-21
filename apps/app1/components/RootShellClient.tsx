"use client";

import { usePathname } from "next/navigation";
import LandingPage from "../components/LandingPage"; // ojo: misma mayúscula que el archivo
import type { SidebarData, Crumb } from "@workspace/ui/types/navigation";

function deriveCrumbs(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  return parts.map((seg, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/");
    const label = seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const isLast = i === parts.length - 1;
    return isLast
      ? ({ type: "page", label } as const)
      : ({ type: "link", label, href } as const);
  });
}

export default function RootShellClient({
  sidebarData,
  children,
}: {
  sidebarData: SidebarData;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const crumbs = deriveCrumbs(pathname);

  return (
    <LandingPage sidebarData={sidebarData} crumbs={crumbs}>
      {children}
    </LandingPage>
  );
}
