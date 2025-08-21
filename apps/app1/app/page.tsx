// apps/app1/app/page.tsx
export const metadata = {
  title: "Home",
  description: "Bienvenido",
};

export default function HomePage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold">Bienvenido</h1>
      <p className="text-muted-foreground mt-2">
        Esta es la portada. Usá el menú para navegar la documentación.
      </p>
    </div>
  );
}
