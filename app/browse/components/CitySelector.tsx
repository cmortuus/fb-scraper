"use client";
import { FB_CITY_OPTIONS } from "@/app/lib/cities";

export default function CitySelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-sm font-medium text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    >
      {FB_CITY_OPTIONS.map((city) => (
        <option key={city.slug} value={city.slug}>
          {city.label}
        </option>
      ))}
    </select>
  );
}
