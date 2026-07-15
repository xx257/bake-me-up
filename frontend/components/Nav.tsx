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
        <Link
          href="/"
          className="font-headline text-[12px] font-medium uppercase tracking-[0.22em] text-muted-foreground"
        >
          Bake Me Up
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
                    ? "bg-primary/15 font-medium text-primary"
                    : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
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
