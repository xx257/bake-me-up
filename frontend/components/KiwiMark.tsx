import Image from "next/image";

// The brand mark — Kiwi, the Shiba in a chef's hat (cropped from the brand sheet).
// Small and quiet: elegant bakery first, Kiwi discovered inside.
const RATIO = 348 / 232; // intrinsic crop aspect

export default function KiwiMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const width = Math.round(size * RATIO);
  return (
    <Image
      src="/kiwi.png"
      alt="Bake Me Up"
      width={width}
      height={size}
      className={`inline-block rounded-md ${className}`}
    />
  );
}
