"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex min-h-11 items-center gap-2 border-2 border-white/30 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-4 focus-visible:outline-white"
      aria-label="Go back to the previous page"
    >
      <ArrowLeft size={17} />
      Back
    </button>
  );
}
