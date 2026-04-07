"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Used Finder" },
  { href: "/browse", label: "Browse" },
  { href: "/microcenter", label: "MicroCenter" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              isActive
                ? "bg-gray-800 text-white"
                : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
