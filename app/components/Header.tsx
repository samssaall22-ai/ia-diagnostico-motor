"use client";

import { SearchCheck } from "lucide-react";

export default function Header() {
  return (
    <header className="flex items-center justify-between">
      <div className="inline-flex items-center gap-3 rounded-2xl border border-[#1f2a3d] bg-[#0b1019]/60 px-4 py-3 backdrop-blur">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#06161a]/60 ring-1 ring-[#06b6d4]/30">
          <SearchCheck className="h-6 w-6 text-[#06b6d4]" />
        </div>
        <div className="leading-tight">
          <div className="text-lg font-semibold tracking-wide text-slate-100 sm:text-xl">
            AutoPrecision Pro
          </div>
          <div className="text-xs font-medium text-slate-400 sm:text-sm">
            Diagnosis tecnica profesional
          </div>
        </div>
      </div>
    </header>
  );
}

