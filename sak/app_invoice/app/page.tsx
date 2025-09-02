"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {  router.push("/admin");   }, [router]);

  return (
    <div className="font-sans flex items-center justify-center min-h-screen p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Invoice App</h1>
        <p className="text-gray-600">Redirecting to admin panel...</p>
      </div>
    </div>
  );
}