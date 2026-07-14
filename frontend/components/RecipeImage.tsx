"use client";

import { useState } from "react";

// Real recipe photo (public/recipes/<slug>.jpg) with a warm emoji fallback if the
// image is missing or fails to load. Users can drop their own photo at that path.
export default function RecipeImage({
  slug,
  emoji,
  alt,
  className = "",
}: {
  slug: string;
  emoji: string;
  alt: string;
  className?: string;
}) {
  const [ok, setOk] = useState(true);

  if (!ok) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-primary/15 to-secondary text-4xl ${className}`}
        aria-hidden
      >
        {emoji}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={`/recipes/${slug}.jpg`}
      alt={alt}
      loading="lazy"
      onError={() => setOk(false)}
      className={`object-cover ${className}`}
    />
  );
}
