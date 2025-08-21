import "@workspace/ui/styles/globals.css";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import RootShellClient from "../components/RootShellClient"; // wrapper cliente
import { sidebarData } from "../components/Navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RootShellClient sidebarData={sidebarData}>
            {children}
          </RootShellClient>
        </ThemeProvider>
      </body>
    </html>
  );
}
