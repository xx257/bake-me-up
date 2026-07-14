"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChefHat } from "lucide-react";

const LINKS = [
  { href: "/", label: "Kitchen", icon: ChefHat },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 px-5 py-3">
        <Link href="/" className="mr-3 flex items-center gap-1.5 font-semibold">
          <span aria-hidden>🍞</span> Bake Me Up
        </Link>
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
