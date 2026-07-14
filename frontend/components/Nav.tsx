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
    <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm">
      <nav className="mx-auto flex w-full max-w-6xl items-center px-5 py-3.5">
        <Link href="/" className="font-display flex items-center gap-1.5 text-lg">
          <span aria-hidden>🍞</span> Bake Me Up
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
