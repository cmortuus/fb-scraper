"use client";

import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import type { Listing } from "@/app/lib/types";
import BrowseListingCard from "./components/BrowseListingCard";
import CategoryFilter from "./components/CategoryFilter";
import CitySelector from "./components/CitySelector";
import ListingSkeleton from "./components/ListingSkeleton";

const STORAGE_KEY = "browse-city";

export default function BrowsePage() {
  const [city, setCity] = useState("seattle");
  const [category, setCategory] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load saved city on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setCity(saved);
  }, []);

  const fetchListings = useCallback(
    async (opts: { city: string; category: string; minPrice: string; maxPrice: string }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ city: opts.city });
      if (opts.category) params.set("category", opts.category);
      if (opts.minPrice) params.set("minPrice", opts.minPrice);
      if (opts.maxPrice) params.set("maxPrice", opts.maxPrice);
      if (searchQuery) params.set("query", searchQuery);

      try {
        const res = await fetch(`/api/browse/facebook?${params}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!controller.signal.aborted) {
          setListings(data.listings ?? []);
          if (data.error) setError(data.error);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Failed to load listings. Check your connection.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [searchQuery]
  );

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchListings({ city, category, minPrice, maxPrice });
    return () => abortRef.current?.abort();
  }, [city, category, fetchListings]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCityChange(slug: string) {
    setCity(slug);
    localStorage.setItem(STORAGE_KEY, slug);
  }

  function handlePriceApply() {
    fetchListings({ city, category, minPrice, maxPrice });
  }

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  }

  function handleSearchClear() {
    setSearchInput("");
    setSearchQuery("");
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-8">
      {/* City selector */}
      <div className="px-4 pt-4 pb-2">
        <CitySelector value={city} onChange={handleCityChange} />
      </div>

      {/* Category pills */}
      <CategoryFilter active={category} onChange={setCategory} />

      {/* Search */}
      <div className="px-4 pb-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="search"
            placeholder="Search listings"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Search
          </button>
          {(searchInput || searchQuery) && (
            <button
              type="button"
              onClick={handleSearchClear}
              className="px-4 py-2.5 bg-gray-800 border border-gray-700 text-sm font-medium text-gray-300 rounded-xl hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Price filter toggle */}
      <div className="px-4 pb-2">
        <button
          onClick={() => setShowPriceFilter(!showPriceFilter)}
          className="text-sm text-indigo-400 font-medium"
        >
          {showPriceFilter ? "Hide price filter" : "Filter by price"}
        </button>
        {showPriceFilter && (
          <div className="flex gap-2 mt-2 items-center">
            <input
              type="number"
              placeholder="Min $"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-100"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              placeholder="Max $"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-100"
            />
            <button
              onClick={handlePriceApply}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Go
            </button>
          </div>
        )}
      </div>

      {/* Status */}
      {loading && (
        <div className="px-4 py-2">
          <p className="text-sm text-gray-400 animate-pulse">
            Loading Facebook Marketplace listings...
          </p>
        </div>
      )}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Listings grid */}
      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <ListingSkeleton key={i} />
            ))}
          </div>
        ) : listings.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {listings.map((listing) => (
              <BrowseListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          !error && (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">No listings found</p>
              <p className="text-sm mt-1">Try a different city, category, or search</p>
            </div>
          )
        )}
      </div>

      {/* Refresh button */}
      {!loading && listings.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => fetchListings({ city, category, minPrice, maxPrice })}
            className="px-6 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors shadow-sm"
          >
            Refresh Listings
          </button>
        </div>
      )}
    </div>
  );
}
