"use client";

import { Shield } from "lucide-react";

export default function OwnerBadge({ size = 14 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-yellow-500 to-orange-500 text-black border border-yellow-400 shadow-sm"
      title="Owner"
    >
      <Shield size={size} />
      OWNER
    </span>
  );
}
