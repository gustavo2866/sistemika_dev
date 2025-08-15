import "@workspace/ui/styles/globals.css";

export const metadata = {
  title: 'app4',
  description: 'App4 - Monorepo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ ['--primary' as any]: 'oklch(62% 0.19 140)' }}>{children}</body>
    </html>
  );
}
