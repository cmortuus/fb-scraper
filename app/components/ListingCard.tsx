"use client";
import type { Listing } from "@/app/lib/types";

const SOURCE_COLORS = {
  craigslist: "bg-purple-100 text-purple-800",
  ebay: "bg-yellow-100 text-yellow-800",
  facebook: "bg-blue-100 text-blue-800",
};

const SOURCE_LABELS = {
  craigslist: "Craigslist",
  ebay: "eBay",
  facebook: "Facebook",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <a
      href={listing.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all overflow-hidden"
    >
      {/* Image */}
      <div className="h-44 bg-gray-100 flex items-center justify-center overflow-hidden">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-4xl text-gray-300">📦</span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug flex-1">
            {listing.title}
          </p>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${SOURCE_COLORS[listing.source]}`}
          >
            {SOURCE_LABELS[listing.source]}
          </span>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="text-lg font-bold text-gray-900">
            {listing.price != null ? `$${listing.price.toLocaleString()}` : "Price N/A"}
          </span>
          <div className="text-right text-xs text-gray-400 leading-tight">
            {listing.location && <div>{listing.location}</div>}
            {listing.postedAt && <div>{timeAgo(listing.postedAt)}</div>}
          </div>
        </div>
      </div>
    </a>
  );
}
