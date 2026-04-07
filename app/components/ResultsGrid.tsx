"use client";
import type { Listing } from "@/app/lib/types";
import ListingCard from "./ListingCard";

interface Props {
  listings: Listing[];
  activeSource: "all" | "craigslist" | "ebay" | "facebook";
  fbUrl: string;
}

export default function ResultsGrid({ listings, activeSource }: Props) {
  const filtered =
    activeSource === "all" ? listings : listings.filter((l) => l.source === activeSource);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <p>No eBay results found. Try the Craigslist or Facebook Marketplace links below.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filtered.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
