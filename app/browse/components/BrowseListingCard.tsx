"use client";
import { useState } from "react";
import type { Listing } from "@/app/lib/types";
import MessageModal from "@/app/components/MessageModal";

export default function BrowseListingCard({ listing }: { listing: Listing }) {
  const [showMessage, setShowMessage] = useState(false);
  const isFacebook = listing.source === "facebook";

  return (
    <>
      <div className="group flex flex-col bg-gray-900 rounded-xl shadow-sm border border-gray-800 hover:shadow-md hover:border-gray-700 transition-all overflow-hidden">
        <a
          href={listing.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col flex-1"
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
        {isFacebook && (
          <button
            onClick={() => setShowMessage(true)}
            className="mx-3 mb-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Message Seller
          </button>
        )}
      </div>
      {showMessage && (
        <MessageModal
          listingUrl={listing.sourceUrl}
          listingTitle={listing.title}
          onClose={() => setShowMessage(false)}
        />
      )}
    </>
  );
}
