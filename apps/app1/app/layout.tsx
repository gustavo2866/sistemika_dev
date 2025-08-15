import "@workspace/ui/globals.css";

export const metadata = {
  title: 'app1',
  description: 'App1 - Monorepo',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
