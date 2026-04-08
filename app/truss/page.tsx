"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const TrussDesigner = dynamic(
  () => import("../components/truss/TrussDesigner"),
  { ssr: false },
);

export default function TrussPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full bg-zinc-900">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Laddar takstolsverktyg...</p>
          </div>
        </div>
      }
    >
      <TrussDesigner />
    </Suspense>
  );
}
