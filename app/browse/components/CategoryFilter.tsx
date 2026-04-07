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
  );
}
