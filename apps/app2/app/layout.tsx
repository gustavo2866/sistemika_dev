import "@workspace/ui/globals.css";

export const metadata = {
  title: 'app2',
  description: 'App2 - Monorepo',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body style={{ ['--primary' as any]: 'oklch(0.6 0.2 30)' }}>{children}</body>
    </html>
  )
}
