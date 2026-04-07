"use client";
import type { Listing } from "@/app/lib/types";

export default function BrowseListingCard({ listing }: { listing: Listing }) {
  return (
    <a
      href={listing.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col bg-gray-900 rounded-xl shadow-sm border border-gray-800 hover:shadow-md hover:border-gray-700 transition-all overflow-hidden"
    >
      <div className="h-36 bg-gray-800 flex items-center justify-center overflow-hidden">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-3xl text-gray-600">📦</span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <span className="text-base font-bold text-gray-100">
          {listing.price != null ? `$${listing.price.toLocaleString()}` : "Price N/A"}
        </span>
        <p className="text-xs text-gray-300 line-clamp-2 leading-snug">
          {listing.title}
        </p>
        {listing.location && (
          <span className="text-xs text-gray-500 mt-auto">{listing.location}</span>
        )}
      </div>
    </a>
  );
}
