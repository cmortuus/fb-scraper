"use client";
import { FB_CATEGORIES } from "@/app/lib/fb-categories";

export default function CategoryFilter({
  active,
  onChange,
}: {
  active: string;
  onChange: (slug: string) => void;
}) {
  return (
    <div className="relative">
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 px-4">
        {FB_CATEGORIES.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => onChange(cat.slug)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              active === cat.slug
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      {/* Fade hints indicating scrollable content */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-gray-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-gray-950 to-transparent" />
    </div>
  );
}
