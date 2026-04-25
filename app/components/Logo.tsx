"use client";

import Image from "next/image";

export function Logo({
  variant = "full",
  className = "",
}: {
  variant?: "full" | "icon";
  className?: string;
}) {
  if (variant === "icon") {
    return (
      <Image
        src="/logos/moonbag-icon-dark.png"
        alt="Moonbag.ai"
        width={40}
        height={40}
        className={className}
        priority
      />
    );
  }
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/logos/moonbag-icon-dark.png"
        alt=""
        width={28}
        height={28}
        priority
      />
      <span className="font-semibold text-[17px] tracking-tight text-white">
        moonbag<span className="text-gradient">.ai</span>
      </span>
    </div>
  );
}
