"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOffIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimeImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Tints the fallback so missing posters still feel on-brand. */
  color?: string | null;
}

export function AnimeImage({ src, alt, className, sizes = "240px", priority, color }: AnimeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const broken = !src || failedSrc === src;

  if (broken) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
        style={color ? { background: `linear-gradient(135deg, ${color}55, transparent)` } : undefined}
      >
        <ImageOffIcon className="size-6 opacity-50" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)} style={color && !loaded ? { backgroundColor: `${color}33` } : undefined}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
        onLoad={() => setLoaded(true)}
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}
