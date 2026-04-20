"use client";

import { useEffect, useState } from "react";

export function TestBanner() {
  const [isTest, setIsTest] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    setIsTest(
      hostname.includes("vercel.app") && !hostname.includes("sistemika-sak-frontend")
    );
  }, []);

  if (!isTest) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-400 text-yellow-900 text-center text-xs font-bold py-1">
      AMBIENTE DE TEST
    </div>
  );
}
