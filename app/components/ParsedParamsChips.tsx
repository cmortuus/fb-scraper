"use client";
import type { SearchParams } from "@/app/lib/types";

interface Props {
  params: SearchParams;
  categoryLabel: string;
}

export default function ParsedParamsChips({ params, categoryLabel }: Props) {
  const chips = [
    { label: "Keywords", value: params.keywords },
    { label: "Category", value: categoryLabel },
    params.location ? { label: "Location", value: params.location } : null,
    params.minPrice != null ? { label: "Min price", value: `$${params.minPrice.toLocaleString()}` } : null,
    params.maxPrice != null ? { label: "Max price", value: `$${params.maxPrice.toLocaleString()}` } : null,
    params.condition && params.condition !== "any"
      ? { label: "Condition", value: params.condition }
      : null,
    params.radiusMiles != null ? { label: "Within", value: `${params.radiusMiles} miles` } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <span className="text-xs text-gray-400 self-center">Claude extracted:</span>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1"
        >
          <span className="text-indigo-400 font-medium">{chip.label}:</span>
          {chip.value}
        </span>
      ))}
    </div>
  );
}
